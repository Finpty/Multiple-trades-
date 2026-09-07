import { requireBusinessAccess } from "@/lib/authz";
import { platformDb } from "@/lib/db";
import { friendlyAction } from "@/lib/business/dashboard";
import { Badge, Input, PageHeader, Select, TBody, Table, Td, Th, THead, formatDateTime, statusTone } from "@/components/ui";
import { AuditRowDetails } from "@/components/admin/config/audit-row";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

export default async function AuditPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ q?: string; severity?: string; entity?: string; page?: string }> }) {
  const { businessId } = await params;
  const sp = await searchParams;
  const ctx = await requireBusinessAccess(businessId, "audit.view");
  const page = Math.max(1, Number(sp.page ?? 1));
  const take = 50;
  const where = {
    businessId,
    ...(sp.q ? { action: { contains: sp.q, mode: "insensitive" as const } } : {}),
    ...(sp.severity && ["INFO", "NOTICE", "WARNING", "CRITICAL"].includes(sp.severity) ? { severity: sp.severity as "INFO" } : {}),
    ...(sp.entity ? { entityType: sp.entity } : {}),
  };
  const [rows, total, entityTypes] = await Promise.all([
    platformDb.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { actor: { select: { name: true, email: true, platformRole: true } } } }),
    platformDb.auditLog.count({ where }),
    platformDb.auditLog.findMany({ where: { businessId }, distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.severity ? { severity: sp.severity } : {}), ...(sp.entity ? { entity: sp.entity } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Audit log" description="Every change made in this business, by whom and when. Platform staff actions are marked." />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_200px_auto]">
        <Input name="q" placeholder="Action contains…" defaultValue={sp.q ?? ""} />
        <Select name="severity" defaultValue={sp.severity ?? ""}><option value="">Any severity</option>{["INFO", "NOTICE", "WARNING", "CRITICAL"].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Select name="entity" defaultValue={sp.entity ?? ""}><option value="">Any entity</option>{entityTypes.map((e) => <option key={e.entityType} value={e.entityType}>{e.entityType}</option>)}</Select>
        <button className="rounded-md bg-neutral-900 px-4 text-sm text-white">Filter</button>
      </form>
      <Table>
        <THead><tr><Th>When</Th><Th>Action</Th><Th>Entity</Th><Th>Actor</Th><Th>Severity</Th><Th></Th></tr></THead>
        <TBody>
          {rows.length === 0 && <tr><Td colSpan={6} className="text-center text-neutral-500">No entries.</Td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-neutral-500">{formatDateTime(r.createdAt)}</Td>
              <Td><span className="font-medium">{friendlyAction(r.action)}</span><span className="block font-mono text-xs text-neutral-500">{r.action}</span></Td>
              <Td className="text-neutral-600">{r.entityType}{r.entityId && <span className="block font-mono text-[10px] text-neutral-400">{r.entityId.slice(0, 8)}</span>}</Td>
              <Td>{r.actor ? <span>{r.actor.name}{r.actor.platformRole !== "NONE" && <Badge tone="purple" className="ml-1">platform</Badge>}</span> : <span className="text-neutral-500">{r.actorType === "API" ? "Website" : "System"}</span>}</Td>
              <Td><Badge tone={r.severity === "CRITICAL" ? "red" : r.severity === "WARNING" ? "amber" : r.severity === "NOTICE" ? "blue" : statusTone("INFO")}>{r.severity}</Badge></Td>
              <Td><AuditRowDetails before={r.before} after={r.after} metadata={r.metadata} /></Td>
            </tr>
          ))}
        </TBody>
      </Table>
      <div className="mt-3 flex items-center justify-between text-sm text-neutral-500"><span>{total} entries</span><span className="flex gap-3">{page > 1 && <Link href={qs(page - 1)} className="underline">Previous</Link>}{page * take < total && <Link href={qs(page + 1)} className="underline">Next</Link>}</span></div>
    </>
  );
}
