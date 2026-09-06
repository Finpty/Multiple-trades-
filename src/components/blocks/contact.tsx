import { loadPrimaryLocation } from "@/lib/site/blocks/location";
import { loadFormBySlug } from "@/lib/site/blocks/forms";
import { listServiceOptions } from "@/lib/site/blocks/services";
import { Container, SectionHeading, SiteIcon } from "@/components/site/primitives";
import { FormRenderer } from "./forms/form-renderer";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center" style={{ background: "color-mix(in srgb, var(--color-accent) 14%, transparent)", color: "var(--color-accent)", borderRadius: "var(--radius)" }}>
        <SiteIcon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-60">{label}</p>
        <div className="mt-0.5 text-base">{children}</div>
      </div>
    </div>
  );
}

/**
 * Contact details from the business row and its primary location (phone,
 * email, address, opening hours) with an optional embedded form.
 */
async function ContactBlock({ props, ctx, settings, editor }: TypedBlockProps<"contact">) {
  const env = blockEnv(ctx, settings, "normal");
  const [location, form] = await Promise.all([loadPrimaryLocation(ctx), loadFormBySlug(ctx, props.formSlug)]);
  const services = form && form.fields.some((f) => f.type === "service") ? await listServiceOptions(ctx) : [];
  const phone = props.showPhone ? (location?.phone ?? ctx.business.phone) : null;
  const email = props.showEmail ? (location?.email ?? ctx.business.email) : null;
  const address = props.showAddress ? location?.addressLines ?? [] : [];
  const hours = props.showHours ? location?.hours ?? [] : [];
  const hasDetails = !!phone || !!email || address.length > 0 || hours.length > 0;
  if (!hasDetails && !form && !editor) return null;

  const details = (
    <div className="space-y-6">
      {phone && (
        <Row icon="phone" label="Phone">
          <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="font-medium hover:underline underline-offset-4">{phone}</a>
        </Row>
      )}
      {email && (
        <Row icon="mail" label="Email">
          <a href={`mailto:${email}`} className="break-all font-medium hover:underline underline-offset-4">{email}</a>
        </Row>
      )}
      {address.length > 0 && (
        <Row icon="map-pin" label="Address">
          <address className="not-italic">
            {address.map((line, i) => (
              <span key={i} className="block">{line}</span>
            ))}
          </address>
        </Row>
      )}
      {hours.length > 0 && (
        <Row icon="clock" label="Opening hours">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {hours.map((h, i) => (
              <div key={i} className="contents">
                <dt className="font-medium">{h.label}</dt>
                <dd className="opacity-80">{h.value}</dd>
              </div>
            ))}
          </dl>
        </Row>
      )}
      {!hasDetails && editor && <p className="text-sm opacity-60">Add a phone, email and primary location in Business settings to show contact details here.</p>}
    </div>
  );

  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} className="mb-10" />
      {form ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <div>{details}</div>
          <div className="p-6 sm:p-8" style={{ background: "var(--color-background)", color: "var(--color-text)", border: "var(--border-width) solid var(--color-border)", borderRadius: "calc(var(--radius) * 1.25)" }}>
            {form.description && <p className="mb-5 text-sm opacity-75">{form.description}</p>}
            <FormRenderer businessId={ctx.business.id} formSlug={form.slug} fields={form.fields} settings={form.settings} services={services} preselectFromQuery buttonClassName={`site-btn--style-${env.tokens.buttonStyle}`} />
          </div>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2">
          {details}
          {editor && props.formSlug && <p className="text-sm opacity-60">Form “{props.formSlug}” was not found or is inactive.</p>}
        </div>
      )}
    </Container>
  );
}

defineBlock("contact", ContactBlock);
