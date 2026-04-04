# ShelfShare

A community book lending app — share physical books with people nearby or within trusted groups.

## Tech Stack

- **Frontend:** React Native / Expo (mobile) + React + Vite (web)
- **Backend:** Fastify (Node.js / TypeScript) running on AWS Lambda
- **Database:** Aurora PostgreSQL Serverless v2 (PostGIS for geo queries)
- **Infra:** AWS CDK — API Gateway, Lambda, SQS, SES, S3 + CloudFront
- **Auth:** Google OIDC → HS256 JWT

## Monorepo Structure

```
packages/
  api/        — Fastify backend
  mobile/     — Expo Router (React Native)
  web/        — React web app
  shared/     — Shared TypeScript types and constants
lambda/
  notifications/  — SQS consumer → SES email sender
  expiry/         — Hourly EventBridge job to expire pending borrow requests
  migrate/        — One-shot DB migration runner
infra/            — AWS CDK stack
```

## Local Development

```bash
cp packages/api/.env.example packages/api/.env
# Fill in: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_MAPS_API_KEY

npm install
npm run dev:api        # API on http://localhost:3000
npm run dev --workspace=packages/web   # Web on http://localhost:5173
```

## Deployment

Pushes to `master` trigger the GitHub Actions deploy workflow automatically:
1. Typecheck + build all packages and Lambdas
2. `cdk deploy` via AWS OIDC (no long-lived keys)

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | IAM role assumed via OIDC |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_MAPS_API_KEY` | Google Maps / Geocoding API key |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs (e.g. CloudFront domain) |
| `ALLOWED_EMAIL_DOMAINS` | Optional — restrict signups by email domain |

### Running Migrations (manual)

```bash
DATABASE_URL=<connection-string> NODE_ENV=production node scripts/migrate.js
```

## Live URLs

- **Web app:** https://d3rr3156fnl7c6.cloudfront.net
- **API:** https://my9l1ex98b.execute-api.ap-south-1.amazonaws.com/prod
