ShelfShare — AI Agent Context Prompt

App Overview

ShelfShare is a community library app that lets book lovers share their physical books with people nearby or within trusted communities (e.g. residential
complexes, friend/family groups). The MVP targets a closed, invite-only beta audience and is designed for quick production feedback.

Core User Flows

1. Auth — Gmail-based login (OIDC). Invite-only signup; users join via invite link/code.
2. My Library — Users catalog their physical books (via ISBN/barcode scan using Google Books API for metadata, or manual entry) and mark each book as
lendable or not.
3. Discover Books — Users search for available books by title/author/genre. Results are filtered by:
   - Radius-based proximity (configurable distance, requires location permission)
   - User-defined communities (e.g. a residential complex or a private group of relatives)
4. Borrow Request Flow — A user requests a book → owner gets an email notification → owner accepts or declines → borrower is notified via email → book status
updates to "lent out" with borrower info and date.
5. Lending Tracker — Owners can see all books currently lent out, to whom, and since when. Borrowers can see their active borrows. Both can mark a book as
returned.
6. Direct Messaging — Users can message each other (1:1) within the app, primarily to coordinate book handoffs.
7. Communities — Users can create or join named communities (private groups). Books can be made visible to specific communities in addition to or instead of
radius-based discovery.

Tech Stack

- Frontend: React Native with Expo (iOS + Android) + React (web)
- Backend: Node.js with Fastify
- Infrastructure: AWS (prioritize OIDC-based security, avoid long-lived IAM credentials)
- Monorepo: npm workspaces
- Language: TypeScript throughout — strict type safety is a hard requirement
- Auth: Gmail via OIDC (Google Identity)
- Notifications: Email only (for MVP)
- Book metadata: Google Books API (ISBN/barcode lookup)

MVP Scope (what's in, what's out)

In:
- Invite-only auth with Gmail
- Library management with barcode scan
- Radius + community-based book discovery
- Borrow request/accept/decline flow with email notifications
- Lending status tracking
- 1:1 direct messaging

Out (post-MVP):
- Book clubs, discussion threads, public reviews
- Push notifications
- Open public signup
- Payment or deposit systems

Key Principles

- TypeScript safety is non-negotiable — no any, strict null checks
- AWS security via OIDC — no hardcoded credentials
- Mobile-first UX, but web parity matters
- Keep the MVP lean — every feature should serve the core loop: find a book → borrow it → return it
