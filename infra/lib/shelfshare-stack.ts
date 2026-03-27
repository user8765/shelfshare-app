import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export class ShelfShareStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC — 2 AZs, public + private subnets
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Aurora PostgreSQL Serverless v2 — min 0 ACU so it scales to zero when idle
    const dbCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0,   // scales to zero — saves ~$30/month for beta
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      defaultDatabaseName: 'shelfshare',
      storageEncrypted: true,
      deletionProtection: false, // set true for prod
    });

    // Redis — external (Redis Cloud free tier, 30MB, sufficient for beta)
    // REDIS_URL stored in Secrets Manager, no ElastiCache resource needed
    const redisSecret = new secretsmanager.Secret(this, 'RedisSecret', {
      description: 'Redis Cloud connection URL for ShelfShare beta',
    });

    // SQS DLQ
    const notificationsDlq = new sqs.Queue(this, 'NotificationsDlq', {
      retentionPeriod: cdk.Duration.days(7),
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // SES — email sending identity (domain must be verified separately)
    new ses.EmailIdentity(this, 'SesIdentity', {
      identity: ses.Identity.domain('shelfshare.app'),
    });

    // DB secret for Lambdas
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      description: 'ShelfShare DB connection string',
    });

    // Auto-expiry Lambda — runs hourly
    const expiryFn = new lambda.Function(this, 'ExpiryLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambda/expiry/dist'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DATABASE_URL: dbSecret.secretValue.unsafeUnwrap(),
      },
      timeout: cdk.Duration.seconds(30),
    });
    dbSecret.grantRead(expiryFn);

    new events.Rule(this, 'ExpirySchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(expiryFn)],
    });

    // Notifications Lambda — SQS consumer
    const notificationsQueue = new sqs.Queue(this, 'NotificationsQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      deadLetterQueue: { queue: notificationsDlq, maxReceiveCount: 3 },
    });

    const notificationsFn = new lambda.Function(this, 'NotificationsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambda/notifications/dist'),
      environment: { SES_FROM_EMAIL: 'noreply@shelfshare.app' },
      timeout: cdk.Duration.seconds(30),
    });
    notificationsFn.addEventSource(
      new lambdaEventSources.SqsEventSource(notificationsQueue, { batchSize: 10 }),
    );

    // Outputs
    new cdk.CfnOutput(this, 'DbClusterEndpoint', { value: dbCluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'EcsClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'NotificationsQueueUrl', { value: notificationsQueue.queueUrl });
    new cdk.CfnOutput(this, 'RedisSecretArn', { value: redisSecret.secretArn });
  }
}
