"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Select, Table, TBody, Td, Th, THead, statusTone } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

interface Member { id: string; userId: string; name: string; email: string; roleId: string; roleName: string; status: string; lastLoginAt: string | null; invitedAt: string | null; isPlatform: boolean }

export function MembersTable({ businessId, currentUserId, roles, members, changeRole, setStatus, remove, resend }: { businessId: string; currentUserId: string; roles: Array<{ id: string; key: string; name: string }>; members: Member[]; changeRole: (b: string, m: string, r: string) => Promise<ActionResult>; setStatus: (b: string, m: string, s: "ACTIVE" | "SUSPENDED") => Promise<ActionResult>; remove: (b: string, m: string) => Promise<ActionResult>; resend: (b: string, m: string) => Promise<ActionResult> }) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); setMsg(r.ok ? { tone: "success", text: r.message ?? "Done" } : { tone: "danger", text: r.error }); router.refresh(); });
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Table>
        <THead><tr><Th>Member</Th><Th>Role</Th><Th>Status</Th><Th>Last sign in</Th><Th></Th></tr></THead>
        <TBody>
          {members.length === 0 && <tr><Td colSpan={5} className="text-center text-neutral-500">No members yet. Invite your team above.</Td></tr>}
          {members.map((m) => (
            <tr key={m.id}>
              <Td><span className="font-medium">{m.name}</span>{m.userId === currentUserId && <Badge className="ml-2">you</Badge>}{m.isPlatform && <Badge tone="purple" className="ml-2">platform staff</Badge>}<span className="block text-xs text-neutral-500">{m.email}</span></Td>
              <Td><Select value={m.roleId} disabled={pending || m.userId === currentUserId} className="w-44" onChange={(e) => run(() => changeRole(businessId, m.id, e.target.value))}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Td>
              <Td><Badge tone={statusTone(m.status)}>{m.status}</Badge></Td>
              <Td className="text-neutral-500">{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : m.invitedAt ? `Invited ${new Date(m.invitedAt).toLocaleDateString()}` : "—"}</Td>
              <Td className="text-right">
                {m.status === "INVITED" && <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => resend(businessId, m.id))}>Resend invite</Button>}
                {m.status === "ACTIVE" && m.userId !== currentUserId && <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setStatus(businessId, m.id, "SUSPENDED"))}>Suspend</Button>}
                {m.status === "SUSPENDED" && <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setStatus(businessId, m.id, "ACTIVE"))}>Reactivate</Button>}
                {m.userId !== currentUserId && <Button variant="ghost" size="sm" disabled={pending} onClick={() => { if (window.confirm(`Remove ${m.name} from this business?`)) run(() => remove(businessId, m.id)); }}>Remove</Button>}
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
