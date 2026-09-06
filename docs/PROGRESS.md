# Progress

## Foundation (complete, verified)

- [x] PostgreSQL canonical schema (Prisma): identity, tenancy, catalogue,
      website, CRM, operations, automation, integrations, AI, audit, analytics
- [x] Forced Row Level Security on all 51 tenant tables + generator script
- [x] Database clients: `prisma` (platform), `tenantDb`, `platformDb`,
      transactional variants; soft-delete guard
- [x] Authentication: Argon2id, hashed sessions, tokens, rate limits, CSRF,
      email verification, password reset, sign-out-everywhere, audit
- [x] Authorization: platform roles, system roles/permissions, memberships,
      `requirePlatformAdmin`, `requireBusinessAccess`
- [x] Tenant routing (path / subdomain / custom domain) + site context
- [x] Domain events (outbox) + automation engine + webhooks + condition engine
- [x] Audit logging
- [x] Storage abstraction (local, S3-compatible) + media route
- [x] AI abstraction (AIService, 5 adapters, encrypted keys, usage logging)
- [x] Theme tokens + CSS variable engine; 9 design families seeded
- [x] Block contract (27 block types) and section settings
- [x] Industry catalogue (22 trades seeded as editable rows)
- [x] `createBusiness()` generation engine and `publishBusiness()` pipeline
      with revisions
- [x] Demo tenants (Kabura Tiling, Elite Plumbing Perth) generated through
      the same engine and published
- [x] Verification script (`scripts/verify-foundation.ts`) passing

## Next

- [ ] Super Admin UI (all sections)
- [ ] Create Business wizard (14 steps)
- [ ] Business admin: website, pages, navigation, live editor, media,
      services, projects, areas, CRM, quotes, jobs, pricing, forms, automations,
      domains, features, custom fields, users, settings, export/import
- [ ] Tenant site renderer + block components
- [ ] Templates, duplication, import/export
- [ ] End-to-end tests of the zero-code flow
