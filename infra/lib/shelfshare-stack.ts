import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export class ShelfShareStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC — single AZ, no NAT Gateway (beta cost optimisation)
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public',   subnetType: ec2.SubnetType.PUBLIC,           cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // Aurora PostgreSQL Serverless v2 — min 0 ACU (scales to zero when idle)
    const dbCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      defaultDatabaseName: 'shelfshare',
      storageEncrypted: true,
      deletionProtection: false, // set true for prod
    });

    // SES — email sending identity
    new ses.EmailIdentity(this, 'SesIdentity', {
      identity: ses.Identity.domain('shelfshare.app'),
    });

    // Secrets — ARNs passed to Lambda, values fetched at cold start (never in env/CF template)
    const dbSecret  = new secretsmanager.Secret(this, 'DbSecret',  { description: 'ShelfShare DB connection string' });
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', { description: 'ShelfShare JWT signing secret' });

    // SQS
    const notificationsDlq = new sqs.Queue(this, 'NotificationsDlq', {
      retentionPeriod: cdk.Duration.days(7),
    });
    const notificationsQueue = new sqs.Queue(this, 'NotificationsQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      deadLetterQueue: { queue: notificationsDlq, maxReceiveCount: 3 },
    });

    // Shared Lambda env — ARNs only, secrets fetched at cold start
    const sharedEnv = {
      DB_SECRET_ARN:           dbSecret.secretArn,
      NOTIFICATIONS_QUEUE_URL: notificationsQueue.queueUrl,
      NODE_ENV:                'production',
    };

    // API Lambda — Fastify via @fastify/aws-lambda
    const apiFn = new lambda.Function(this, 'ApiLambda', {
      runtime:     lambda.Runtime.NODEJS_20_X,
      handler:     'index.handler',
      code:        lambda.Code.fromAsset('../packages/api/dist'),
      vpc,
      vpcSubnets:  { subnetType: ec2.SubnetType.PUBLIC },
      environment: {
        ...sharedEnv,
        JWT_SECRET_ARN:      jwtSecret.secretArn,
        GOOGLE_CLIENT_ID:    process.env['GOOGLE_CLIENT_ID'] ?? '',
        GOOGLE_MAPS_API_KEY: process.env['GOOGLE_MAPS_API_KEY'] ?? '',
        ALLOWED_ORIGINS:     process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:5173',
      },
      timeout:     cdk.Duration.seconds(30),
      memorySize:  512,
    });
    dbSecret.grantRead(apiFn);
    jwtSecret.grantRead(apiFn);
    notificationsQueue.grantSendMessages(apiFn);

    // API Gateway → API Lambda
    const api = new apigateway.LambdaRestApi(this, 'ApiGateway', {
      handler: apiFn,
      proxy:   true,
    });

    // Auto-expiry Lambda — runs hourly
    const expiryFn = new lambda.Function(this, 'ExpiryLambda', {
      runtime:     lambda.Runtime.NODEJS_20_X,
      handler:     'index.handler',
      code:        lambda.Code.fromAsset('../lambda/expiry/dist'),
      vpc,
      vpcSubnets:  { subnetType: ec2.SubnetType.PUBLIC },
      environment: { DB_SECRET_ARN: dbSecret.secretArn },
      timeout:     cdk.Duration.seconds(30),
    });
    dbSecret.grantRead(expiryFn);
    new events.Rule(this, 'ExpirySchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets:  [new targets.LambdaFunction(expiryFn)],
    });

    // Notifications Lambda — SQS consumer
    const notificationsFn = new lambda.Function(this, 'NotificationsLambda', {
      runtime:     lambda.Runtime.NODEJS_20_X,
      handler:     'index.handler',
      code:        lambda.Code.fromAsset('../lambda/notifications/dist'),
      environment: { SES_FROM_EMAIL: 'noreply@shelfshare.app' },
      timeout:     cdk.Duration.seconds(30),
    });
    notificationsFn.addEventSource(
      new lambdaEventSources.SqsEventSource(notificationsQueue, { batchSize: 10 }),
    );

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl',              { value: api.url });
    new cdk.CfnOutput(this, 'DbClusterEndpoint',   { value: dbCluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'NotificationsQueueUrl', { value: notificationsQueue.queueUrl });
  }
}
