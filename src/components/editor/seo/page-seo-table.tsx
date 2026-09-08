"use client";

import * as React from "react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import type { PageSeo } from "@/lib/website/pages";

export function PageSeoTable({ businessId, pages, save }: { businessId: string; pages: Array<{ id: string; title: string; slug: string; seo: PageSeo }>; save: (b: string, p: string, patch: { title?: string; description?: string; noindex?: boolean }) => Promise<ActionResult> }) {
  const [pending, start] = React.useTransition();
  const [state, setState] = React.useState(Object.fromEntries(pages.map((p) => [p.id, { title: p.seo.title ?? "", description: p.seo.description ?? "", noindex: !!p.seo.noindex, dirty: false, saved: false }])));
  const set = (id: string, patch: Partial<{ title: string; description: string; noindex: boolean }>) => setState({ ...state, [id]: { ...state[id], ...patch, dirty: true, saved: false } });
  return (
    <Card>
      <CardHeader title="Page titles & descriptions" description="Quick edits per page. Leave blank to use the page title and site defaults." />
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2">Page</th><th className="px-4 py-2">SEO title</th><th className="px-4 py-2">Description</th><th className="px-4 py-2">noindex</th><th></th></tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {pages.map((p) => { const s = state[p.id]; return (
            <tr key={p.id}>
              <td className="px-4 py-2"><span className="font-medium">{p.title}</span><span className="block text-xs text-neutral-500">/{p.slug}</span></td>
              <td className="px-4 py-2"><Input value={s.title} onChange={(e) => set(p.id, { title: e.target.value })} /></td>
              <td className="px-4 py-2"><Input value={s.description} onChange={(e) => set(p.id, { description: e.target.value })} /></td>
              <td className="px-4 py-2"><input type="checkbox" checked={s.noindex} onChange={(e) => set(p.id, { noindex: e.target.checked })} /></td>
              <td className="px-4 py-2 text-right"><Button size="sm" variant={s.dirty ? "primary" : "ghost"} disabled={pending || !s.dirty} onClick={() => start(async () => { const r = await save(businessId, p.id, { title: s.title, description: s.description, noindex: s.noindex }); setState((st) => ({ ...st, [p.id]: { ...st[p.id], dirty: !r.ok, saved: r.ok } })); })}>{s.saved ? "Saved" : "Save"}</Button></td>
            </tr>
          ); })}
        </tbody>
      </table>
    </Card>
  );
}
