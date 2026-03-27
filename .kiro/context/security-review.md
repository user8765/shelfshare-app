# ShelfShare — Security Review Report
Generated: 2026-03-27

## CRITICAL

**1. ✅ FIXED — JWT_SECRET passed as plaintext Lambda environment variable**
JWT_SECRET now stored in Secrets Manager, fetched via SDK at cold start. ARN passed as env var instead of value.

**2. ✅ FIXED — DATABASE_URL passed via `unsafeUnwrap()` into Lambda env**
DB connection string now fetched from Secrets Manager at cold start via `getSecrets()`. CloudFormation template contains only the secret ARN.

**3. ✅ FIXED — `getBorrowRequestById` has no ownership check**
Added `AND (requester_id = $2 OR book_id IN (SELECT id FROM books WHERE owner_id = $2))` ownership filter.

---

## HIGH

**4. ✅ FIXED — No rate limiting on auth endpoint**
Added `@fastify/rate-limit` — global 100 req/min, `/auth/*` routes limited to 10 req/min per IP.

**5. ✅ FIXED — Invite-only flow broken for new users**
`POST /auth/google/callback` now accepts optional `inviteCode`, validates before account creation. First user (bootstrap) is exempt.

**6. ✅ FIXED — Community membership not verified before accessing member list**
`GET /communities/:id/members` now returns 403 if requester is not a member.

**7. ✅ FIXED — CORS wildcard `origin: '*'`**
CORS now restricted to `ALLOWED_ORIGINS` env var (defaults to localhost for dev).

**8. ✅ FIXED — Secrets Manager secret is empty at deploy**
`getSecrets()` called at Lambda cold start — throws immediately with a clear error if any secret ARN is missing or secret value is empty.

---

## MEDIUM

**9. Unbounded `q` param in `/discover`**
No max length on search query string.
Fix: add `.max(200)` on `q`.

**10. `system_config` writable by anyone with DB access**
No API protection on borrow expiry config.

**11. Error messages leak internal details**
`err.message` passed directly to client on 500s.
Fix: map internal errors to generic messages.

**12. No security headers**
No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`.
Fix: add `@fastify/helmet`.

**13. Message XSS risk on web client**
Message content stored as-is; if rendered as HTML it's an XSS vector.
Fix: ensure web client renders message content as plain text only.

---

## LOW

**14. Community invite codes never expire**
User invites expire (7 days), community invite codes do not.
Fix: add `expires_at` to communities or add a rotate-invite endpoint.

**15. ✅ FIXED — JWT algorithm not explicitly pinned**
`jwt.verify` now uses `{ algorithms: ['HS256'] }` and `jwt.sign` uses `{ algorithm: 'HS256' }`.

**16. No pagination on unbounded endpoints**
`GET /borrow-requests` and `GET /messages/:userId` return unbounded result sets.

---

## Summary Table

| # | Severity | Issue | Fix effort |
|---|---|---|---|
| 1 | Critical | JWT_SECRET in Lambda env | Small |
| 2 | Critical | DB URL via unsafeUnwrap | Small |
| 3 | Critical | No ownership check on getBorrowRequestById | Small |
| 4 | High | No rate limit on auth | Small |
| 5 | High | Invite-only flow broken for new users | Medium |
| 6 | High | Community members visible to non-members | Small |
| 7 | High | CORS wildcard | Small |
| 8 | High | Empty secret at deploy | Small |
| 9 | Medium | Unbounded `q` param | Trivial |
| 10 | Medium | system_config unprotected | Low risk for beta |
| 11 | Medium | Error messages leak internals | Small |
| 12 | Medium | No security headers | Trivial |
| 13 | Medium | Message XSS risk on web client | Small |
| 14 | Low | Community invite codes never expire | Small |
| 15 | Low | JWT algorithm not pinned | Trivial |
| 16 | Low | No pagination | Medium |

---

## Authentication Deep-Dive (Round 2)

**A1. ✅ FIXED — Existing users bypass invite gate**
The `catch` block on `redeemInvite` silently swallowed failed redemptions and issued a JWT anyway.
Fix: returning users (existing `google_id`) skip the invite gate entirely — only new signups require an invite. Logic is now explicit and separate.

**A2. ✅ FIXED — Invite redemption not atomic with account creation**
`upsertUser` and `redeemInvite` ran sequentially with no transaction. A crash between them left orphaned accounts.
Fix: new user signup wraps `upsertUser` + `redeemInvite` in a single DB transaction. Rollback on any failure.

**A3. ✅ FIXED — No email domain restriction**
Any Google account could attempt login. For closed beta this is a risk.
Fix: optional `ALLOWED_EMAIL_DOMAINS` env var (comma-separated). If set, emails from other domains are rejected at token verification with 403.

**A4. ✅ FIXED — JWT contains `email` claim, never re-validated**
Stale email in JWT used for 7 days if user changes Google email.
Fix: `email` removed from JWT payload entirely. JWT now contains only `sub` (user ID) and `tv` (token version).

**A5. ✅ FIXED — No JWT revocation mechanism**
No way to force-logout a user or invalidate compromised tokens before 7-day expiry.
Fix: added `token_version` column to `users` table (`migration 008`). JWT includes `tv` claim. On every request, middleware verifies `tv` matches DB value. Increment `token_version` to instantly invalidate all tokens for a user.
