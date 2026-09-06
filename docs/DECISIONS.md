# Architecture Decision Records

## ADR-001 PostgreSQL is canonical
SQLite was considered for zero-config local use and rejected: the platform is
designed for millions of rows, concurrent writers, RLS, partitioning and
jsonb indexing. Prisma targets PostgreSQL only; migrations, enums, indexes and
RLS policies are PostgreSQL-specific by design.

## ADR-002 Prisma ORM with per-query RLS scoping
Prisma gives a typed schema and migrations. Row Level Security is applied via
a client extension that wraps each query in a batch transaction setting
`app.current_business_id` (or `app.bypass_rls`). Trade-off: one extra
round-trip per query; benefit: stateless, pool-safe, no per-tenant DB roles.

## ADR-003 Forced RLS ("fail closed")
`FORCE ROW LEVEL SECURITY` makes even the table owner subject to policies, so
the raw client sees nothing tenant-owned. Missing scoping surfaces as empty
results in development instead of data leakage in production.

## ADR-004 In-house authentication on proven primitives
Requirement: no external auth dependency, but not amateur. We follow the
Copenhagen Book patterns (opaque hashed session tokens, Argon2id, single-use
hashed tokens, DB-backed rate limits) instead of a hosted IdP. OAuth and
passkeys are modelled so they can be added without schema changes.

## ADR-005 Organisation → Business hierarchy
Organisations own billing and can hold many businesses (franchise, holding
company, agency). Business is the tenant boundary for RLS because all
public-facing configuration and customer data is per business.

## ADR-006 Data-driven industries
Industries are rows carrying default services, fields, pricing, stages,
website sections, lead questions and terminology. The seed catalogue
bootstraps 22 trades once; from then on Super Admin owns them. New trades
require no code.

## ADR-007 Draft rows + published snapshots + revisions
Draft page content is relational (`page_sections`) for fine-grained editing;
publishing writes an immutable jsonb snapshot to `pages.published` and a
`revisions` row. Visitors always read snapshots (fast, consistent); editors
can restore any revision.

## ADR-008 Blocks are a schema registry, not per-business components
Each block has a zod schema and a renderer. Data blocks read tenant rows at
render time. This forbids `KaburaServiceGrid`-style components.

## ADR-009 Domain events with an outbox
Events are persisted in `domain_events` and dispatched in-process to
subscribers (automation, webhooks, notifications). Persistence enables retry
and later external workers without changing emitters.

## ADR-010 Storage abstraction
Bytes live behind `StorageDriver` (local disk, S3-compatible). DB stores
`(driver, key)`; drivers can be migrated object by object.

## ADR-011 AI is optional and abstracted
`AIService` → adapter → provider over plain `fetch` (no vendor SDKs).
Global `ai.enabled` plus per-provider enablement; every AI feature has a
manual fallback. Zero runtime dependency on any Claude subscription.

## ADR-012 Money as integer cents
Avoids floating point; adequate for trade quotes/invoices. Rates use
`numeric(14,4)`.

## ADR-013 Next.js 15 App Router, single deployment
Server components render tenant sites from snapshots; server actions handle
admin mutations with built-in CSRF protection; middleware performs host-based
tenant routing without touching the database.

## ADR-014 Soft delete + lifecycle states
Important records use `deletedAt` (auto-hidden) and explicit status enums
(DRAFT/PUBLISHED/ARCHIVED, ACTIVE/ARCHIVED). Physical deletion is reserved
for platform maintenance jobs.
