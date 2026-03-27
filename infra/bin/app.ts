import * as cdk from 'aws-cdk-lib';
import { ShelfShareStack } from '../lib/shelfshare-stack';

const app = new cdk.App();

new ShelfShareStack(app, 'ShelfShareStack', {
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] ?? 'ap-south-1',
  },
});
