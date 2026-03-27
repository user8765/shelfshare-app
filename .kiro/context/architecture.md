# ShelfShare — Architecture Document

## 1. Product Specification

### 1.1 Actors
- **User** — authenticated member (Gmail/OIDC)
- **Owner** — user who lists books
- **Borrower** — user who requests/borrows books
- **Community Admin** — user who manages a community

### 1.2 Functional Requirements

**Auth**
- Gmail OIDC login only
- Invite-only signup — existing users generate invite links
- No cap on invites per user
- User profile: display name, avatar (from Google), bio, location (street/pincode, not exact)

**Library Management**
- Add books via ISBN barcode scan (Google Books API) or manual entry
- Per-book visibility: radius-only, community-only, both, or private
- Book locked (no edit/delete) while lent out

**Discovery**
- Search by title / author / genre
- Filter by: 5km radius from user's stored location, community membership, or both
- Geocode user's street/pincode to lat/lng on save (Google Geocoding API)

**Borrow Flow**
- User requests available book → owner notified (email)
- FCFS — first request locks the book as "pending"
- Owner accepts/declines → borrower notified (email)
- On accept: book status = `lent_out`, due date set (owner proposes, borrower agrees)
- Due date extension: either party proposes → other confirms
- Pending requests auto-expire after configurable X hours → notification sent

**Lending Tracker**
- Owner: all lent books, to whom, since when, due date
- Borrower: active borrows, due dates
- Either party marks book as returned → status resets to `available`

**Messaging**
- 1:1 in-app messaging
- Email fallback for new messages (configurable per user)
- Long-term message persistence

**Communities**
- Any user can create a community
- Community has an admin role
- Members join via invite link/code
- Books can be scoped to specific communities

**Notifications (Email only, MVP)**
- Borrow request received
- Request accepted/declined
- Request auto-expired
- Book due soon / overdue
- New message received (if email fallback enabled)
- Due date extension proposed/confirmed

### 1.3 Non-Functional Requirements
- TypeScript strict mode throughout — no `any`
- OIDC-based AWS auth — no long-lived IAM credentials
- Mobile-first, full web parity
- Beta scale: ~100 users
- Stateless API (JWT-based sessions)

---

## 2. High-Level Design (HLD)

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│   React Native / Expo (iOS + Android)  │  React (Web)   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / WSS
┌────────────────────▼────────────────────────────────────┐
│                  AWS API Gateway (HTTP)                  │
│              + WebSocket API (messaging)                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Fastify API  (Node.js / TS)                 │
│         Running on ECS Fargate (single service)          │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │   Auth   │ │ Library  │ │ Borrow   │ │  Messaging │  │
│  │  Module  │ │  Module  │ │  Module  │ │   Module   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │Community │ │Discovery │ │Notif.    │                 │
│  │  Module  │ │  Module  │ │Module    │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
└───────┬──────────────┬──────────────┬───────────────────┘
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────▼────────────────┐
│  Aurora       │ │ ElastiCache│ │   SQS Queues         │
│  PostgreSQL   │ │   Redis    │ │  (notifications,     │
│  (RDS)        │ │  (sessions,│ │   expiry jobs)       │
│               │ │  WS state) │ │                      │
└───────────────┘ └────────────┘ └──────────┬───────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Lambda Workers  │
                                    │  - Email (SES)   │
                                    │  - Expiry check  │
                                    │  - Geocoding     │
                                    └─────────────────┘
```

### 2.2 Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Database | Aurora PostgreSQL Serverless v2 | PostGIS for geo queries, scales to zero for beta |
| Cache / WS state | ElastiCache Redis | WebSocket connection registry, session cache |
| Async jobs | SQS + Lambda | Decoupled notifications, expiry processing |
| Email | AWS SES | Native AWS, cheap at beta scale |
| Geo | Google Geocoding API + PostGIS | Geocode on address save, radius query via PostGIS |
| Container | ECS Fargate | No server management, OIDC task roles |
| Auth | Google OIDC → JWT (RS256) | Stateless, no long-lived credentials |
| WebSocket | API Gateway WebSocket + Redis pub/sub | Scales across Fargate instances |

### 2.3 Data Flow — Borrow Request

```
Borrower taps "Request"
  → POST /borrow-requests
  → Book status: available → pending (optimistic lock)
  → SQS: notify_owner event
  → Lambda: send email to owner

Owner accepts
  → PATCH /borrow-requests/:id { action: "accept", dueDate }
  → Book status: pending → lent_out
  → SQS: notify_borrower event
  → Lambda: send email to borrower

Auto-expiry (EventBridge Scheduler → Lambda every hour)
  → Query pending requests older than X hours
  → Status: pending → expired
  → Book status: pending → available
  → SQS: notify_expiry to both parties
```

### 2.4 Monorepo Structure

```
shelfshare/
├── packages/
│   ├── api/              # Fastify backend
│   ├── mobile/           # React Native / Expo
│   ├── web/              # React web app
│   └── shared/           # Shared TS types, validators, constants
├── infra/                # AWS CDK (IaC)
└── package.json          # npm workspaces root
```

---

## 3. Low-Level Design (LLD)

### 3.1 Database Schema

```sql
-- Users
users (
  id            UUID PK,
  google_id     TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  bio           TEXT,
  location_text TEXT,              -- raw input (street / pincode)
  location      GEOGRAPHY(POINT),  -- PostGIS, geocoded
  email_notif   BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)

-- Invites
invites (
  id            UUID PK,
  code          TEXT UNIQUE NOT NULL,
  inviter_id    UUID FK users,
  invitee_email TEXT,              -- optional, can be open link
  used_by       UUID FK users,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ
)

-- Books
books (
  id            UUID PK,
  owner_id      UUID FK users,
  isbn          TEXT,
  title         TEXT NOT NULL,
  author        TEXT,
  genre         TEXT,
  cover_url     TEXT,
  description   TEXT,
  status        TEXT CHECK (status IN ('available','pending','lent_out','unavailable')),
  is_lendable   BOOLEAN DEFAULT true,
  visibility    TEXT CHECK (visibility IN ('radius','community','both','private')),
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)

-- Book <> Community visibility
book_communities (
  book_id       UUID FK books,
  community_id  UUID FK communities,
  PRIMARY KEY (book_id, community_id)
)

-- Communities
communities (
  id            UUID PK,
  name          TEXT NOT NULL,
  description   TEXT,
  invite_code   TEXT UNIQUE NOT NULL,
  created_by    UUID FK users,
  created_at    TIMESTAMPTZ
)

-- Community Members
community_members (
  community_id  UUID FK communities,
  user_id       UUID FK users,
  role          TEXT CHECK (role IN ('admin','member')),
  joined_at     TIMESTAMPTZ,
  PRIMARY KEY (community_id, user_id)
)

-- Borrow Requests
borrow_requests (
  id            UUID PK,
  book_id       UUID FK books,
  requester_id  UUID FK users,
  status        TEXT CHECK (status IN ('pending','accepted','declined','expired','returned')),
  due_date      DATE,
  proposed_due_date      DATE,
  extension_proposed_by  UUID FK users,
  request_expires_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)

-- Messages
messages (
  id            UUID PK,
  sender_id     UUID FK users,
  recipient_id  UUID FK users,
  content       TEXT NOT NULL,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ
)

-- System Config
system_config (
  key           TEXT PK,
  value         TEXT NOT NULL
)
-- e.g. key='borrow_request_expiry_hours', value='48'
```

### 3.2 API Routes

```
Auth
  POST   /auth/google/callback
  POST   /auth/refresh
  DELETE /auth/session

Users
  GET    /users/me
  PATCH  /users/me
  GET    /users/:id

Invites
  POST   /invites
  POST   /invites/redeem

Books
  GET    /books
  POST   /books
  GET    /books/:id
  PATCH  /books/:id
  DELETE /books/:id

Discovery
  GET    /discover?q=&lat=&lng=&radius=&communityId=

Borrow Requests
  POST   /borrow-requests
  GET    /borrow-requests?role=owner|borrower
  PATCH  /borrow-requests/:id   # action: accept|decline|return|propose-extension|confirm-extension

Communities
  POST   /communities
  GET    /communities/:id
  PATCH  /communities/:id
  POST   /communities/:id/join
  GET    /communities/:id/members
  PATCH  /communities/:id/members/:userId

Messages
  GET    /messages/conversations
  GET    /messages/:userId
  POST   /messages/:userId
```

### 3.3 WebSocket (Messaging)

- Client connects to API Gateway WebSocket with JWT in query param
- On connect: Lambda registers `{ connectionId, userId }` in Redis
- Message sent via `POST /messages/:userId` → stored in DB → published to Redis channel → Fargate picks up → pushes to recipient's connectionId via API Gateway Management API
- On disconnect: Lambda removes from Redis

### 3.4 Key Algorithms

**Radius Discovery (PostGIS)**
```sql
SELECT b.* FROM books b
JOIN users u ON b.owner_id = u.id
WHERE b.status = 'available'
  AND b.is_lendable = true
  AND (b.visibility = 'radius' OR b.visibility = 'both')
  AND ST_DWithin(u.location, ST_MakePoint($lng, $lat)::geography, $radius_meters)
  AND b.owner_id != $current_user_id
```

**FCFS Lock (prevent double-booking)**
```sql
UPDATE books SET status = 'pending'
WHERE id = $book_id AND status = 'available'
RETURNING id
-- 0 rows updated → 409 Conflict
```

**Auto-expiry (Lambda, runs hourly)**
```sql
UPDATE borrow_requests SET status = 'expired'
WHERE status = 'pending' AND request_expires_at < NOW()
RETURNING book_id, requester_id;

UPDATE books SET status = 'available'
WHERE id = ANY($expired_book_ids)
```

---

## 4. Implementation Backlog

### Phase 0 — Monorepo & Infra Bootstrap ✅
- [x] Init npm workspaces: `packages/api`, `packages/mobile`, `packages/web`, `packages/shared`
- [x] TypeScript strict config in each package
- [x] AWS CDK in `infra/` — VPC, Aurora Serverless v2, ElastiCache Redis, ECS Fargate, SQS, SES
- [x] CI pipeline (GitHub Actions) — typecheck, build (triggers on master + PRs)

### Phase 1 — Auth ✅
- [x] Google OIDC callback → RS256 JWT
- [x] Invite code generation + redemption
- [x] JWT middleware
- [x] `users` + `invites` migrations

### Phase 2 — User Profile & Location
- [ ] `PATCH /users/me`
- [ ] Google Geocoding API → PostGIS on location save
- [ ] Enable PostGIS on Aurora

### Phase 3 — Library Management
- [ ] Books CRUD
- [ ] Google Books API ISBN lookup
- [ ] Lock enforcement on lent_out books
- [ ] `book_communities` visibility logic

### Phase 4 — Communities
- [ ] Community CRUD
- [ ] Invite code join flow
- [ ] Admin role middleware
- [ ] Member management endpoints

### Phase 5 — Discovery
- [ ] Radius query via PostGIS
- [ ] Community-scoped query
- [ ] Combined visibility query
- [ ] Full-text search (PostgreSQL `tsvector`)

### Phase 6 — Borrow Flow
- [ ] FCFS atomic lock on request creation
- [ ] Accept/decline + status transitions
- [ ] Due date + extension proposal flow
- [ ] `request_expires_at` from `system_config`
- [ ] Auto-expiry Lambda (EventBridge Scheduler, hourly)

### Phase 7 — Notifications
- [ ] SQS queue + Lambda consumer
- [ ] SES email templates (all notification types)
- [ ] Per-user email fallback toggle

### Phase 8 — Messaging
- [ ] `messages` migration
- [ ] REST send/fetch endpoints
- [ ] API Gateway WebSocket API
- [ ] Connect/disconnect Lambda → Redis registry
- [ ] Real-time delivery: Redis pub/sub → Fargate → API Gateway Management API

### Phase 9 — Mobile App
- [ ] Expo project, Expo Router navigation
- [ ] Auth screens (Google Sign-In)
- [ ] Library + barcode scanner (Expo Camera)
- [ ] Discover screen (map/list toggle)
- [ ] Borrow request flow
- [ ] Lending tracker
- [ ] Messaging
- [ ] Communities

### Phase CD — Continuous Deployment (after Phase 4)
- [x] GitHub Actions OIDC trust with AWS (no long-lived keys)
- [ ] Dockerfile for `packages/api`
- [ ] ECR repository (add to CDK stack)
- [ ] ECS task definition + Fargate service (add to CDK stack)
- [ ] GitHub Actions CD workflow — build image → push to ECR → update ECS service on push to master

### Phase 10 — Web App
- [ ] React + Vite setup
- [ ] Feature parity with mobile

### Phase 11 — Hardening
- [ ] Rate limiting (Fastify rate-limit)
- [ ] Input validation (Zod in `shared/`)
- [ ] Structured logging (Pino)
- [ ] DB connection pooling (RDS Proxy)
- [ ] Secrets in AWS Secrets Manager
