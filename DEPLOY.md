# ShelfShare — Deployment Guide

## First-Time Setup

### 1. AWS OIDC Trust (one-time)
Create an IAM role that GitHub Actions can assume via OIDC:
```bash
# Trust policy already in trust-policy.json
aws iam create-role \
  --role-name ShelfShareDeploy \
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
  --role-name ShelfShareDeploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### 2. Bootstrap CDK (one-time per AWS account/region)
```bash
cd infra
npm ci
npx cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1
```

### 3. GitHub Secrets
Set these in your repo → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | ARN of the IAM role created above |
| `DB_SECRET_ARN` | ARN of the DbSecret (output after first `cdk deploy`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs e.g. `https://app.shelfshare.app` |
| `ALLOWED_EMAIL_DOMAINS` | Optional — e.g. `gmail.com` to restrict signups |

### 4. First Deploy
```bash
cd infra
GOOGLE_CLIENT_ID=... GOOGLE_MAPS_API_KEY=... npx cdk deploy
```
Note the outputs — copy `DbClusterEndpoint` and `NotificationsQueueUrl`.

### 5. Populate Secrets in AWS Secrets Manager
After first deploy, set the actual secret values:
```bash
# DB connection string
aws secretsmanager put-secret-value \
  --secret-id <DbSecret ARN from CDK output> \
  --secret-string "postgresql://user:pass@<DbClusterEndpoint>:5432/shelfshare"

# JWT signing secret (generate a strong random string)
aws secretsmanager put-secret-value \
  --secret-id <JwtSecret ARN from CDK output> \
  --secret-string "$(openssl rand -base64 48)"
```

### 6. Run Migrations
```bash
DB_SECRET_ARN=<DbSecret ARN> NODE_ENV=production node scripts/migrate.js
```

### 7. Verify SES Domain
```bash
# SES domain verification is triggered by CDK but requires DNS record
# Check AWS Console → SES → Verified Identities → shelfshare.app
# Add the CNAME records to your DNS provider
```

## Subsequent Deploys
Push to `master` — GitHub Actions handles everything automatically:
1. Typecheck
2. Build all packages + Lambdas
3. Run DB migrations
4. `cdk deploy`

## Local Development
```bash
cp packages/api/.env.example packages/api/.env
# Fill in DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_MAPS_API_KEY
npm install
npm run dev:api
```
