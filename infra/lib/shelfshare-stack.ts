import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class ShelfShareStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC — 2 AZs, public + private subnets
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Aurora PostgreSQL Serverless v2
    const dbCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      defaultDatabaseName: 'shelfshare',
      storageEncrypted: true,
      deletionProtection: false, // set true for prod
    });

    // ElastiCache Redis (single node for beta)
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'ShelfShare Redis subnet group',
      subnetIds: vpc.privateSubnets.map((s) => s.subnetId),
    });

    new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: 'cache.t4g.micro',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
    });

    // SQS Queues
    const notificationsDlq = new sqs.Queue(this, 'NotificationsDlq', {
      retentionPeriod: cdk.Duration.days(7),
    });

    new sqs.Queue(this, 'NotificationsQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      deadLetterQueue: { queue: notificationsDlq, maxReceiveCount: 3 },
    });

    // ECS Cluster (Fargate tasks added per service in later phases)
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // SES — email sending identity (domain must be verified separately)
    new ses.EmailIdentity(this, 'SesIdentity', {
      identity: ses.Identity.domain('shelfshare.app'), // replace with actual domain
    });

    // Outputs
    new cdk.CfnOutput(this, 'DbClusterEndpoint', { value: dbCluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'EcsClusterName', { value: cluster.clusterName });

    // DB secret for Lambda
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

    // EventBridge rule — trigger every hour
    new events.Rule(this, 'ExpirySchedule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(expiryFn)],
    });
  }
}
