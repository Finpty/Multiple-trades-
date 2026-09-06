# Building on TRADE ONE — conventions

Read this before adding any feature. These rules keep every business
isolated, every operation auditable, and the platform free of per-business
code.

## Non-negotiables

1. **No business, trade or company is ever named in code.** Content comes from
   rows. Trades come from `industries`. If you need an example, use the
   seeded demo through the database, never a constant.
2. **No AI dependency.** Core flows never call `AIService`. AI-assisted
   buttons are optional extras that catch `AIUnavailableError` and show the
   manual path. Check `getAIAvailability()` before rendering them.
3. **No schema changes without a migration.** `prisma/schema.prisma` is the
   contract. Prefer existing jsonb columns (`settings`, `metadata`, `data`)
   for feature-specific extras. If a change is unavoidable: edit the schema,
   `pnpm db:migrate:dev --name <change>`, then `pnpm db:rls` into a new
   migration when a tenant table was added.
4. **No new npm dependencies** unless the task explicitly allows it.

## Authorization and data access

```ts
// Pages / layouts (redirects on failure)
const ctx = await requireBusinessAccess(businessId, "services.manage");
// Server actions / route handlers (throws → ActionResult)
const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
ctx.db        // RLS-scoped Prisma client — use for ALL tenant queries
ctx.user      // current user
ctx.can(perm) // permission check for conditional UI
```

- Super Admin: `const { user, db } = await requirePlatformAdmin("ADMIN")`.
  `db` is `platformDb` (bypasses RLS). Use `tenantDb(id)` when acting inside
  one business from the super admin.
- Never read `businessId` from a client payload and trust it: it is always
  the route param that went through `requireBusinessAccess`.
- Multi-statement writes: `withTenantTransaction(businessId, async (tx) => …)`.
- Always `where: { businessId }` in addition to RLS (belt and braces, and it
  keeps queries index-friendly).

## Server actions

```ts
"use server";
export async function saveThing(prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "x.manage", { throwOnly: true });
    const input = Schema.parse(formToObject(formData));   // zod; ZodError → fieldErrors
    … mutate with ctx.db …
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "thing.updated", entityType: "thing", entityId, before, after });
    await emitEvent({ type: "…", businessId, payload, actorUserId: ctx.user.id });   // when in the catalogue
    revalidatePath(`/admin/${businessId}/things`);
    return ok(undefined, "Saved");
  });
}
```

Client side: `<ActionForm action={saveThing}>…</ActionForm>` (from
`@/components/ui/action-form`) with `<SubmitButton>`. Read field errors from
the render-prop `fieldErrors`.

Route handlers that mutate: call `assertSameOrigin(request)` first.

## UI

- Use `@/components/ui` primitives (`PageHeader`, `Card`, `Table`, `Badge`,
  `Field`, `Input`, `Select`, `Switch`, `EmptyState`, `Alert`, `Tabs`, …).
- Images/videos are picked with `<MediaPicker businessId value onChange name>`
  from `@/components/admin/media-picker`. Never ask for an external URL.
- Lists with ordering use `@dnd-kit` (installed). Keep drag handles explicit.
- Every list page has an empty state that tells the owner what to do next.
- Every destructive action is soft (`deletedAt` / status ARCHIVED) and confirmed
  with `<ConfirmButton>`.

## Website engine

- Blocks: schema in `src/lib/blocks/schema.ts`; renderer in
  `src/components/blocks/<type>.tsx` registered via `registerBlock`.
  Data blocks load with `tenantDb(ctx.business.id)` and resolve media via
  `mediaUrls()`. Mark editable text with `data-edit-field="<propPath>"` and
  images with `data-edit-image="<propPath>"` so the live editor works.
- Links inside the site: `siteHref(ctx, "/services/slug")`.
- Draft → publish → revisions live in `src/lib/business/publish.ts`.

## Events, audit, automation

- Emit domain events for the actions in `src/lib/events/types.ts`.
- Record audits for every mutation (`recordAudit`). Redaction is automatic.
- Automations react to events; add new action types in
  `src/lib/automation/actions.ts` and list them in `AUTOMATION_ACTION_TYPES`.

## Media

- Uploads go through `uploadMedia()`; bytes live in object storage.
- Keys are `<businessId>/…`; the DB stores `(storageDriver, storageKey)`.

## Verification before finishing

```
pnpm typecheck
pnpm exec tsx scripts/verify-foundation.ts
pnpm build       # when routes changed
```
