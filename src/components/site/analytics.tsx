"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SITE_API, type SiteAnalyticsEvent } from "@/lib/site/public-api";
import { EDITOR_PARAM, PREVIEW_PARAM } from "@/lib/editor/protocol";

const SESSION_KEY = "to_site_session";

function sessionId(): string | null {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function isPreviewContext(): boolean {
  if (typeof window === "undefined") return true;
  if (window.self !== window.top) return true; // live editor iframe
  const params = new URLSearchParams(window.location.search);
  return params.has(PREVIEW_PARAM) || params.has(EDITOR_PARAM);
}

function send(event: SiteAnalyticsEvent) {
  try {
    const body = JSON.stringify(event);
    if (navigator.sendBeacon && navigator.sendBeacon(SITE_API.analytics, new Blob([body], { type: "application/json" }))) return;
    void fetch(SITE_API.analytics, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => undefined);
  } catch {
    // analytics must never break the page
  }
}

/**
 * First-party analytics beacon. Records a page_view per navigation and
 * cta_click / phone_click for elements carrying data-track. Disabled when
 * the business feature "analytics" is off, in preview/editor mode, and when
 * the visitor has Do-Not-Track enabled.
 */
export function SiteAnalytics({ businessId, enabled }: { businessId: string; enabled: boolean }) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!enabled || isPreviewContext()) return;
    if (navigator.doNotTrack === "1") return;
    const path = window.location.pathname + window.location.search;
    send({ businessId, type: "page_view", path, referrer: document.referrer || null, sessionId: sessionId(), metadata: { title: document.title, viewport: window.innerWidth } });
  }, [businessId, enabled, pathname]);

  React.useEffect(() => {
    if (!enabled || isPreviewContext()) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      const raw = el.dataset.track;
      const type: SiteAnalyticsEvent["type"] | null = raw === "cta_click" || raw === "phone_click" || raw === "form_start" || raw === "quote_request" ? raw : null;
      if (!type) return;
      send({ businessId, type, path: window.location.pathname, sessionId: sessionId(), metadata: { label: (el.textContent ?? "").trim().slice(0, 120), href: el.getAttribute("href") ?? undefined } });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [businessId, enabled]);

  return null;
}
