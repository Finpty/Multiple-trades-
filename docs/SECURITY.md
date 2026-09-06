# Security

## Authentication (who you are)

Implemented in `src/lib/auth/*` following the Copenhagen Book / OWASP
guidance rather than an external identity vendor — but with production-grade
primitives:

| Requirement            | Implementation                                                            |
|------------------------|---------------------------------------------------------------------------|
| Password hashing       | Argon2id (`@node-rs/argon2`), 19 MiB / t=2 / p=1; transparent re-hash     |
| Sessions               | 256-bit random token; only SHA-256 hash stored; 30-day sliding expiry     |
| Cookies                | `HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/`              |
| Invalidation           | per-session revoke; `sessionVersion` bump signs out everywhere            |
| Email verification     | single-use hashed token (24h), `auth_tokens`                              |
| Password reset         | single-use hashed token (1h), all sessions invalidated on reset           |
| Rate limiting          | DB-backed fixed windows: login (10/15min per email, 50/15min per IP),     |
|                        | reset (5/h)                                                               |
| CSRF                   | Server Actions: built-in origin check. Route handlers: `assertSameOrigin` |
| Enumeration resistance | uniform errors; dummy hash on unknown user; reset always "succeeds"       |
| MFA readiness          | `users.mfaEnabled`, `mfaSecretEncrypted`; `passkeys` table (WebAuthn)     |
| OAuth readiness        | `oauth_accounts` (provider, providerAccountId, encrypted tokens)          |
| Audit                  | login success/failure, logout, resets, verification, password changes     |

Password strength: ≥10 characters, no trivial repetition. Raise via
`validatePasswordStrength`.

## Authorization (what you may do)

Separate from authentication. `src/lib/authz/*`:

- **Platform roles** live on `users.platformRole` (`NONE | SUPPORT | ADMIN |
  OWNER`). Only `ADMIN`/`OWNER` reach `/super-admin`. The value is never
  derived from any membership, so no tenant admin can grant platform access.
- **Roles** are rows with a permission array. System roles are seeded
  (`org_owner`, `org_admin`, `org_member`, `business_owner`, `business_admin`,
  `business_editor`, `business_staff`, `business_viewer`).
- **Memberships** bind users to organisations and businesses with a role.
- `requirePlatformAdmin()` and `requireBusinessAccess(businessId, permission)`
  are the only gates. They run server-side in every page, server action and
  route handler. The client never decides.

## Tenant isolation

Defence in depth: application scoping (`tenantDb`) **and** PostgreSQL forced
RLS. Even a bug that forgets a `where businessId` clause cannot read or write
another tenant's rows. See `docs/DATABASE.md`.

## Secrets

- `PLATFORM_SECRET` (env) derives per-purpose keys via HKDF.
- Integration secrets, AI provider keys, OAuth tokens and webhook secrets are
  stored AES-256-GCM encrypted (`encryptSecret`) and never returned to clients
  (masked with `maskSecret`).
- No AI vendor credential exists in the codebase or env by default.

## Media

Objects are keyed `<businessId>/…`; the database stores only references.
`PRIVATE` objects are served only via signed URLs or to authorised members;
`PUBLIC` objects are immutable-cached. Uploads validate MIME type and size
against platform settings and are processed by `sharp` (images).

## Tenant domains

Only `VERIFIED` custom domains resolve in production. Verification is a DNS
TXT record containing a per-domain token. Platform surfaces (`/admin`,
`/super-admin`, `/api/*` except `/api/site/*`) return 404 on tenant hosts.

## Operational

- `/api/health` checks DB connectivity only.
- Purge expired sessions/tokens/rate-limit rows on a schedule.
- Audit log is append-only; export it for retention.
