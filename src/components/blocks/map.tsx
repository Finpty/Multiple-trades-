import Link from "next/link";
import { siteHref } from "@/lib/tenant/resolve";
import { loadPrimaryLocation } from "@/lib/site/blocks/location";
import { loadServiceAreasForBlock } from "@/lib/site/blocks/areas";
import { Container, SectionHeading, SiteIcon } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** OpenStreetMap embed (no API key) around a lat/lng at a zoom level. */
function osmBboxSrc(lat: number, lng: number, zoom: number): string {
  const span = 360 / Math.pow(2, zoom) * 1.6; // approx degrees of longitude visible
  const dLng = span / 2;
  const dLat = (span / 2) * Math.cos((lat * Math.PI) / 180);
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(5)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
}

/**
 * Map: OpenStreetMap iframe from lat/lng (block props, else the primary
 * location). With only an address, a search link opens the map externally.
 * Service areas list beneath when enabled.
 */
async function MapBlock({ props, ctx, settings, editor }: TypedBlockProps<"map">) {
  const env = blockEnv(ctx, settings, "normal");
  const [location, areas] = await Promise.all([loadPrimaryLocation(ctx), props.showServiceAreas ? loadServiceAreasForBlock(ctx, { limit: 40 }) : Promise.resolve([])]);
  const lat = typeof props.lat === "number" ? props.lat : location?.lat ?? null;
  const lng = typeof props.lng === "number" ? props.lng : location?.lng ?? null;
  const address = props.address?.trim() || location?.addressQuery || "";
  const zoom = props.zoom ?? 11;
  const hasCoords = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  if (!hasCoords && !address && areas.length === 0 && !editor) return null;
  const searchHref = hasCoords ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}` : address ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}` : null;

  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} className="mb-8" />
      <div className="overflow-hidden" style={{ borderRadius: "var(--radius)", border: "var(--border-width) solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" }}>
        {hasCoords ? (
          <iframe src={osmBboxSrc(lat!, lng!, zoom)} title={props.heading || "Map"} className="block h-[320px] w-full sm:h-[420px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ border: 0 }} />
        ) : (
          <div className="flex h-[240px] flex-col items-center justify-center gap-3 px-6 text-center" style={{ color: "var(--color-muted)" }}>
            <SiteIcon name="map-pin" size={32} strokeWidth={1.4} />
            {address ? <p className="text-sm">{address}</p> : <p className="text-sm">{editor ? "Add an address or coordinates in the section panel, or set a primary location." : "Location coming soon."}</p>}
          </div>
        )}
        {(address || searchHref) && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            {address && (
              <span className="inline-flex items-center gap-2" data-edit-field={props.address ? "address" : undefined}>
                <SiteIcon name="map-pin" size={15} className="shrink-0 opacity-60" />
                {address}
              </span>
            )}
            {searchHref && (
              <a href={searchHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--color-accent)" }}>
                Open in maps
                <SiteIcon name="external-link" size={14} />
              </a>
            )}
          </div>
        )}
      </div>
      {areas.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">Areas we serve</p>
          <ul className="flex flex-wrap gap-2">
            {areas.map((a) => (
              <li key={a.id}>
                {a.href ? (
                  <Link href={siteHref(ctx, a.href)} className="inline-block px-3 py-1.5 text-sm font-medium hover:underline underline-offset-4" style={{ background: env.onDark ? "rgba(255,255,255,0.12)" : "var(--color-surface)", border: "var(--border-width) solid var(--color-border)", borderRadius: "999px" }}>
                    {a.name}
                  </Link>
                ) : (
                  <span className="inline-block px-3 py-1.5 text-sm font-medium" style={{ background: env.onDark ? "rgba(255,255,255,0.12)" : "var(--color-surface)", border: "var(--border-width) solid var(--color-border)", borderRadius: "999px" }}>{a.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  );
}

defineBlock("map", MapBlock);
