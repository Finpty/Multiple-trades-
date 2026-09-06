import { promises as dns } from "node:dns";
import type { BusinessDomain } from "@prisma/client";
import { platformDb, tenantDb } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { emitEvent } from "@/lib/events";
import { recordAudit } from "@/lib/audit";
import { platformHosts } from "@/lib/env";
import { getPlatformSetting } from "@/lib/platform/settings";

/**
 * Domain lifecycle for tenant sites. Verification is a DNS TXT record so it
 * works with any registrar; hosting-provider automation (SSL provisioning,
 * adding the domain to the edge) is behind DomainProviderAdapter.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export const VERIFY_RECORD_PREFIX = "_tradeone-verify";
const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export function normaliseHostname(input: string): string {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  if (!HOSTNAME_RE.test(host)) throw new DomainError("Enter a valid domain name such as example.com.au.");
  for (const platform of platformHosts()) if (host === platform || host.endsWith("." + platform)) throw new DomainError("That hostname belongs to the platform.");
  return host;
}

export interface DnsInstruction {
  type: "TXT" | "CNAME" | "A";
  name: string;
  value: string;
  purpose: string;
}

export async function dnsInstructions(domain: Pick<BusinessDomain, "hostname" | "verificationToken">): Promise<DnsInstruction[]> {
  const target = (await getPlatformSetting<string>("domains.cnameTarget", "")) || platformHosts()[0] || "localhost";
  const apex = domain.hostname.split(".").length <= 2 || /\.(com|net|org|co)\.[a-z]{2}$/.test(domain.hostname);
  return [
    { type: "TXT", name: `${VERIFY_RECORD_PREFIX}.${domain.hostname}`, value: domain.verificationToken, purpose: "Proves you control the domain." },
    apex
      ? { type: "A", name: domain.hostname, value: (await getPlatformSetting<string>("domains.aRecord", "")) || "<platform IP>", purpose: "Points the apex domain at the platform." }
      : { type: "CNAME", name: domain.hostname, value: target, purpose: "Points the domain at the platform." },
  ];
}

export async function addDomain(businessId: string, hostnameInput: string, ctx: { actorUserId: string | null; kind?: "CUSTOM" | "SUBDOMAIN" }): Promise<BusinessDomain> {
  const hostname = normaliseHostname(hostnameInput);
  const existing = await platformDb.businessDomain.findUnique({ where: { hostname } });
  if (existing) throw new DomainError(existing.businessId === businessId ? "This domain is already added." : "This domain is already in use by another business.");
  const db = tenantDb(businessId);
  const count = await db.businessDomain.count({ where: { businessId } });
  const domain = await db.businessDomain.create({
    data: { businessId, hostname, kind: ctx.kind ?? "CUSTOM", verificationToken: `tradeone-verify=${randomToken(18)}`, isPrimary: count === 0 },
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "domain.added", entityType: "domain", entityId: domain.id, severity: "NOTICE", after: { hostname } });
  await emitEvent({ type: "domain.added", businessId, payload: { businessId, domainId: domain.id, hostname }, actorUserId: ctx.actorUserId });
  return domain;
}

/** Checks the TXT record (and, informatively, the CNAME/A record). */
export async function verifyDomain(businessId: string, domainId: string, ctx: { actorUserId: string | null }): Promise<BusinessDomain> {
  const db = tenantDb(businessId);
  const domain = await db.businessDomain.findUniqueOrThrow({ where: { id: domainId } });
  let verified = false;
  let error: string | null = null;
  try {
    const records = await dns.resolveTxt(`${VERIFY_RECORD_PREFIX}.${domain.hostname}`);
    verified = records.some((r) => r.join("").trim() === domain.verificationToken);
    if (!verified) error = "TXT record found but the value does not match.";
  } catch (e) {
    error = `No TXT record found (${(e as NodeJS.ErrnoException).code ?? "lookup failed"}).`;
  }
  const updated = await db.businessDomain.update({
    where: { id: domainId },
    data: {
      verificationStatus: verified ? "VERIFIED" : "FAILED",
      verifiedAt: verified ? new Date() : domain.verifiedAt,
      lastCheckedAt: new Date(),
      verificationError: verified ? null : error,
      sslStatus: verified && domain.sslStatus === "NONE" ? "PENDING" : domain.sslStatus,
    },
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: verified ? "domain.verified" : "domain.verification_failed", entityType: "domain", entityId: domainId, severity: "NOTICE", metadata: { hostname: domain.hostname, error } });
  if (verified) {
    await emitEvent({ type: "domain.verified", businessId, payload: { businessId, domainId, hostname: domain.hostname }, actorUserId: ctx.actorUserId });
    await getDomainProvider().then((p) => p.onVerified(updated)).catch((e) => console.error("[domains] provider onVerified failed", e));
  }
  return updated;
}

export async function setPrimaryDomain(businessId: string, domainId: string, ctx: { actorUserId: string | null }): Promise<void> {
  const db = tenantDb(businessId);
  await db.businessDomain.updateMany({ where: { businessId }, data: { isPrimary: false } });
  await db.businessDomain.update({ where: { id: domainId }, data: { isPrimary: true } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "domain.primary_changed", entityType: "domain", entityId: domainId, severity: "NOTICE" });
}

export async function setDomainRedirect(businessId: string, domainId: string, redirectToDomainId: string | null, redirectType: 301 | 302, ctx: { actorUserId: string | null }): Promise<void> {
  const db = tenantDb(businessId);
  await db.businessDomain.update({ where: { id: domainId }, data: { redirectToDomainId, redirectType } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "domain.redirect_changed", entityType: "domain", entityId: domainId, metadata: { redirectToDomainId, redirectType } });
}

export async function removeDomain(businessId: string, domainId: string, ctx: { actorUserId: string | null }): Promise<void> {
  const db = tenantDb(businessId);
  const domain = await db.businessDomain.delete({ where: { id: domainId } });
  await getDomainProvider().then((p) => p.onRemoved(domain)).catch(() => undefined);
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "domain.removed", entityType: "domain", entityId: domainId, severity: "NOTICE", before: { hostname: domain.hostname } });
}

export async function updateSslStatus(businessId: string, domainId: string, sslStatus: "NONE" | "PENDING" | "ACTIVE" | "ERROR", provider: string | null, ctx: { actorUserId: string | null }): Promise<void> {
  await tenantDb(businessId).businessDomain.update({ where: { id: domainId }, data: { sslStatus, sslProvider: provider } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "domain.ssl_updated", entityType: "domain", entityId: domainId, metadata: { sslStatus, provider } });
}

/** Re-checks every pending/failed domain (cron). */
export async function recheckPendingDomains(limit = 50): Promise<number> {
  const rows = await platformDb.businessDomain.findMany({ where: { verificationStatus: { in: ["PENDING", "FAILED"] } }, orderBy: { lastCheckedAt: "asc" }, take: limit });
  for (const d of rows) await verifyDomain(d.businessId, d.id, { actorUserId: null }).catch(() => undefined);
  return rows.length;
}

/* ── Hosting provider automation ─────────────────────────────────────────── */

export interface DomainProviderAdapter {
  readonly id: string;
  readonly label: string;
  /** Called after DNS verification succeeds: register the hostname with the edge / provision SSL. */
  onVerified(domain: BusinessDomain): Promise<void>;
  onRemoved(domain: BusinessDomain): Promise<void>;
  /** Poll SSL/attachment status. */
  status(domain: BusinessDomain): Promise<{ sslStatus: "NONE" | "PENDING" | "ACTIVE" | "ERROR"; detail?: string }>;
}

const manualProvider: DomainProviderAdapter = {
  id: "manual",
  label: "Manual (reverse proxy / any host)",
  async onVerified(domain) {
    await platformDb.businessDomain.update({ where: { id: domain.id }, data: { sslProvider: "manual" } });
  },
  async onRemoved() {},
  async status(domain) {
    return { sslStatus: domain.sslStatus, detail: "Update SSL status manually after configuring your proxy/CDN." };
  },
};

/** Vercel Domains API adapter (token + project id from platform settings). */
const vercelProvider: DomainProviderAdapter = {
  id: "vercel",
  label: "Vercel",
  async onVerified(domain) {
    const { token, projectId, teamId } = await vercelConfig();
    if (!token || !projectId) return;
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    const res = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains${q}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name: domain.hostname }),
    });
    await platformDb.businessDomain.update({ where: { id: domain.id }, data: { sslProvider: "vercel", sslStatus: res.ok ? "PENDING" : "ERROR", providerConfig: { vercelStatus: res.status } } });
  },
  async onRemoved(domain) {
    const { token, projectId, teamId } = await vercelConfig();
    if (!token || !projectId) return;
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain.hostname)}${q}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }).catch(() => undefined);
  },
  async status(domain) {
    const { token, projectId, teamId } = await vercelConfig();
    if (!token || !projectId) return { sslStatus: domain.sslStatus, detail: "Vercel not configured" };
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    const res = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain.hostname)}${q}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return { sslStatus: "ERROR", detail: `Vercel responded ${res.status}` };
    const data = (await res.json()) as { verified?: boolean };
    return { sslStatus: data.verified ? "ACTIVE" : "PENDING" };
  },
};

async function vercelConfig() {
  const cfg = await getPlatformSetting<{ token?: string; projectId?: string; teamId?: string }>("domains.vercel", {});
  return { token: cfg.token, projectId: cfg.projectId, teamId: cfg.teamId };
}

export const DOMAIN_PROVIDERS: DomainProviderAdapter[] = [manualProvider, vercelProvider];

export async function getDomainProvider(): Promise<DomainProviderAdapter> {
  const id = await getPlatformSetting<string>("domains.provider", "manual");
  return DOMAIN_PROVIDERS.find((p) => p.id === id) ?? manualProvider;
}
