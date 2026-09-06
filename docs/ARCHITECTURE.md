# TRADE ONE — Architecture

TRADE ONE is a single deployment that serves any number of trade businesses.
Everything that makes one business different from another — industry, brand,
theme, pages, services, pricing, locations, forms, workflow, features, domain —
is **data in PostgreSQL**, created and edited from the admin UI. There is no
per-business code, no per-business repository and no per-business deployment.

Claude (or any AI) was used to *build* the platform. Nothing in the runtime
depends on Claude, an AI subscription, or a developer being present.

## Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router) — one deployment                                │
│                                                                          │
│  /super-admin    Platform control centre (platform OWNER/ADMIN only)     │
│  /admin/[id]     Business admin (membership + permission gated)          │
│  /_sites/[site]  Tenant website renderer (rewritten from host/path)      │
│  /api/site/*     Public tenant endpoints (forms, analytics)              │
│  /media/*        Object serving with visibility checks                   │
├──────────────────────────────────────────────────────────────────────────┤
│  src/lib — services & engines (framework-agnostic TypeScript)            │
│    business/   create · publish · duplicate · export · templates         │
│    blocks/     block contract (schemas, metadata)                        │
│    theme/      design tokens → CSS variables                             │
│    pricing/    pricing engine + rule evaluation                          │
│    rules/      generic condition evaluator                               │
│    automation/ WHEN/THEN engine                                          │
│    events/     domain events (outbox) + handlers                         │
│    auth/       sessions, passwords, tokens, rate limits, CSRF            │
│    authz/      roles, permissions, tenant access                         │
│    tenant/     host/path → business resolution                           │
│    storage/    object storage drivers (local, S3)                        │
│    ai/         AIService + provider adapters (optional)                  │
│    audit.ts    append-only audit trail                                   │
├──────────────────────────────────────────────────────────────────────────┤
│  Prisma 6 → PostgreSQL 14+ with forced Row Level Security               │
│  Object storage (local disk or any S3-compatible store)                  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tenancy model

```
Platform
 └── Organization            (billing/ownership boundary, may own many businesses)
      └── Business           (the tenant; everything public-facing hangs here)
           ├── BusinessLocation   physical premises / depots
           ├── BusinessMembership user ↔ business ↔ role
           ├── BusinessTheme, BusinessDomain, BusinessFeature, BusinessSetting
           ├── Page → PageSection, NavigationMenu, Revision
           ├── Service, ServiceArea, Material, Media, Project, TeamMember, Review
           ├── CustomFieldDefinition/Value, PricingItem, PricingRule
           ├── Customer, Lead, Quote, Form, FormSubmission
           ├── Workflow, Job, Task, Invoice, Payment, Booking
           ├── AutomationRule/Run, Message, Webhook, Integration, AiProvider
           └── AuditLog, DomainEvent, AnalyticsEvent
```

Every tenant-owned row carries `businessId`. Ownership is enforced twice:

1. **Application**: `requireBusinessAccess(businessId, permission)` is the only
   entry point for tenant code. It returns an RLS-scoped database client.
2. **Database**: PostgreSQL RLS policies (forced, so even the table owner is
   subject to them) restrict every read and write to
   `app.current_business_id`. See `docs/DATABASE.md`.

## Request flow for a tenant site

1. `src/middleware.ts` (edge, no DB) classifies the host:
   platform host + `/kabura/...` → path mode; `kabura.tradeone.com` → subdomain;
   anything else → custom domain. It rewrites to `/_sites/<site>/<path>`.
2. `loadSiteContext()` resolves the business (by slug, or by verified domain),
   its published theme and menus using a tenant-scoped client.
3. The page engine loads `pages.published` (an immutable snapshot) and renders
   each section through the block registry. Draft content renders only for
   authorised editors in preview mode.
4. Links are built with `siteHref()` so the same content works in every mode.

## Business generation

`createBusiness()` (`src/lib/business/create.ts`) is the single engine used by
the Super Admin wizard, templates, duplication, import and the seed. From an
`Industry` row plus the details entered, it materialises: organisation,
business, location, theme (design family + overrides), features, nested
services, workflow, custom fields (job/estimate/lead), pricing items and rules,
forms, service areas, system pages with sections, navigation and default
automations. `publishBusiness()` snapshots drafts into published JSON and
records revisions.

Industries are rows (`industries`). Creating a new trade = creating a row in
Super Admin → Industries. Nothing in code lists trades or companies except the
one-time bootstrap catalogue in `src/lib/catalog/industries.ts`, which only
seeds rows that do not exist yet.

## Website engine

- **Blocks**: `src/lib/blocks/schema.ts` declares each block's zod schema and
  metadata; renderers in `src/components/blocks/*` receive `(props, ctx)`.
  Blocks that show data (services, projects, reviews, areas, forms) read from
  the tenant's rows — components never contain business content.
- **Theme**: `ThemeTokens` (design family preset + business overrides) are
  emitted as CSS variables on the site root. Nine design families are seeded;
  more can be added in Super Admin → Design System.
- **Draft / preview / publish / history**: `page_sections` are the draft;
  `pages.published` is what visitors see; `revisions` keeps every published
  version (and an auto-save before restore) so any version can be restored.

## Events, automation, integrations

Important mutations call `emitEvent()`; events are persisted (`domain_events`)
and dispatched to subscribers: the automation engine (business-defined
WHEN/THEN rules), webhooks, and — when enabled — AI assistants. Emitters never
know their subscribers.

## AI (optional)

`AIService` is the only entry point. Providers (Anthropic, OpenAI, Google,
OpenAI-compatible, local) are configured in Super Admin → AI Providers with
encrypted keys, or per business. A global `ai.enabled` switch and the absence
of providers both cause `AIUnavailableError`; every feature that calls AI must
present the manual path. No core operation calls `AIService`.

## Scale considerations

- uuid PKs, timestamptz, jsonb configuration, composite indexes on every
  `(businessId, …)` access path; append-only audit/event/analytics tables are
  partition-ready by `createdAt`.
- Media bytes never enter the database; only object references do.
- Rate limiting is database-backed so it holds across instances.
- Prisma queries are RLS-scoped per query (batch transaction) — stateless and
  safe with connection pooling (PgBouncer in transaction mode is supported).
