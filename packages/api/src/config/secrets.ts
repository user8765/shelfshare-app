import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

async function fetchSecret(arn: string): Promise<string> {
  const res = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  const val = res.SecretString;
  if (!val) throw new Error(`Secret ${arn} is empty`);
  return val;
}

export interface AppSecrets {
  databaseUrl: string;
  jwtSecret: string;
}

let cached: AppSecrets | null = null;

export async function getSecrets(): Promise<AppSecrets> {
  if (cached) return cached;

  const isLambda = !!process.env['AWS_LAMBDA_FUNCTION_NAME'];

  if (isLambda) {
    const dbArn  = process.env['DB_SECRET_ARN'];
    const jwtArn = process.env['JWT_SECRET_ARN'];
    if (!dbArn || !jwtArn) throw new Error('DB_SECRET_ARN and JWT_SECRET_ARN must be set');
    cached = {
      databaseUrl: await fetchSecret(dbArn),
      jwtSecret:   await fetchSecret(jwtArn),
    };
  } else {
    // Local dev — fall back to env vars
    const databaseUrl = process.env['DATABASE_URL'];
    const jwtSecret   = process.env['JWT_SECRET'];
    if (!databaseUrl) throw new Error('DATABASE_URL not set');
    if (!jwtSecret)   throw new Error('JWT_SECRET not set');
    cached = { databaseUrl, jwtSecret };
  }

  return cached;
}
