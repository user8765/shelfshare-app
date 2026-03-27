import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ses from 'aws-cdk-lib/aws-ses';
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
  }
}
