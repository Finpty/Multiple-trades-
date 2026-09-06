import type { SectionSeed } from "@/lib/blocks/schema";

/**
 * Default website composition for a newly generated business. Everything is
 * expressed as data (block type + props) and interpolated from the business
 * record; industries may override any page's sections via Industry.websiteSections.
 */
export interface BusinessSeedInfo {
  name: string;
  tagline?: string | null;
  description?: string | null;
  industryName: string;
  serviceAreaText?: string | null;
  phone?: string | null;
  email?: string | null;
  terminology: Record<string, string>;
}

export interface SystemPageSeed {
  systemKey: string;
  slug: string;
  title: string;
  showInNav: boolean;
  sortOrder: number;
  sections: SectionSeed[];
  seo?: { title?: string; description?: string };
}

const t = (info: BusinessSeedInfo, key: string, fallback: string) => info.terminology[key] ?? fallback;

export function defaultSystemPages(info: BusinessSeedInfo): SystemPageSeed[] {
  const services = t(info, "services", "Services");
  const projects = t(info, "projects", "Projects");
  const area = info.serviceAreaText ? ` across ${info.serviceAreaText}` : "";
  return [
    {
      systemKey: "home",
      slug: "",
      title: "Home",
      showInNav: true,
      sortOrder: 0,
      seo: { title: `${info.name} | ${info.industryName}${info.serviceAreaText ? ` in ${info.serviceAreaText}` : ""}`, description: info.tagline ?? info.description ?? "" },
      sections: [
        { type: "hero", props: { layout: "split", eyebrow: info.industryName, heading: info.tagline ?? `${info.industryName} done properly${area}`, subheading: info.description ?? `${info.name} delivers quality ${info.industryName.toLowerCase()} work with clear quotes and reliable timelines.`, primaryCta: { label: "Request a quote", href: "/quote", style: "primary" }, secondaryCta: { label: `View ${projects.toLowerCase()}`, href: "/projects", style: "secondary" }, highlights: ["Fully licensed & insured", "Fixed-price quotes", "Workmanship guarantee"] } },
        { type: "services", props: { heading: `Our ${services.toLowerCase()}`, source: "all", layout: "grid", limit: 8 }, settings: { background: "surface" } },
        { type: "features", props: { heading: `Why choose ${info.name}`, items: [{ title: "Clear communication", description: "You always know what happens next and when." }, { title: "Quality materials", description: "We only use products we would put in our own homes." }, { title: "On time, on budget", description: "Detailed quotes and realistic schedules." }] } },
        { type: "projects", props: { heading: `Recent ${projects.toLowerCase()}`, source: "featured", limit: 6, layout: "grid" }, settings: { background: "surface" } },
        { type: "reviews", props: { heading: "What our customers say", source: "featured", limit: 6, layout: "grid" } },
        { type: "process", props: { heading: "How it works", source: "workflow", steps: [] } },
        { type: "service_areas", props: { heading: `Areas we service`, layout: "tags", limit: 40 }, settings: { background: "surface" } },
        { type: "cta", props: { heading: "Ready to get started?", body: "Tell us about your project and we'll come back with a clear, itemised quote.", primaryCta: { label: "Request a quote", href: "/quote", style: "primary" }, secondaryCta: info.phone ? { label: `Call ${info.phone}`, href: `tel:${info.phone.replace(/\s+/g, "")}`, style: "secondary" } : undefined, style: "band" } },
      ],
    },
    {
      systemKey: "services",
      slug: "services",
      title: services,
      showInNav: true,
      sortOrder: 1,
      sections: [
        { type: "page_header", props: { heading: services, subheading: `Everything ${info.name} can do for your property.` } },
        { type: "services", props: { source: "all", layout: "list", limit: 48, showPricing: true } },
        { type: "cta", props: { heading: "Not sure which service you need?", body: "Send us a few photos and a description; we'll point you in the right direction.", primaryCta: { label: "Get in touch", href: "/contact", style: "primary" }, style: "card" } },
      ],
    },
    {
      systemKey: "projects",
      slug: "projects",
      title: projects,
      showInNav: true,
      sortOrder: 2,
      sections: [
        { type: "page_header", props: { heading: projects, subheading: "A selection of recent work." } },
        { type: "projects", props: { source: "all", limit: 48, layout: "grid" } },
      ],
    },
    {
      systemKey: "about",
      slug: "about",
      title: "About",
      showInNav: true,
      sortOrder: 3,
      sections: [
        { type: "page_header", props: { heading: `About ${info.name}` } },
        { type: "text", props: { body: info.description ?? `${info.name} is a ${info.industryName.toLowerCase()} business${area}. Update this text from the admin.`, width: "narrow" } },
        { type: "stats", props: { items: [{ value: "100%", label: "Licensed & insured" }, { value: "5★", label: "Customer rating" }, { value: "Local", label: "Owned & operated" }] }, settings: { background: "surface" } },
        { type: "team", props: { heading: "Meet the team", source: "all" } },
      ],
    },
    {
      systemKey: "reviews",
      slug: "reviews",
      title: "Reviews",
      showInNav: true,
      sortOrder: 4,
      sections: [
        { type: "page_header", props: { heading: "Reviews" } },
        { type: "reviews", props: { source: "all", limit: 24, layout: "list" } },
      ],
    },
    {
      systemKey: "areas",
      slug: "areas",
      title: "Service Areas",
      showInNav: true,
      sortOrder: 5,
      sections: [
        { type: "page_header", props: { heading: "Areas we service", subheading: info.serviceAreaText ?? undefined } },
        { type: "service_areas", props: { layout: "grid", limit: 200 } },
        { type: "map", props: { showServiceAreas: true } },
      ],
    },
    {
      systemKey: "contact",
      slug: "contact",
      title: "Contact",
      showInNav: true,
      sortOrder: 6,
      sections: [
        { type: "page_header", props: { heading: "Contact us" } },
        { type: "contact", props: { formSlug: "contact" } },
      ],
    },
    {
      systemKey: "quote",
      slug: "quote",
      title: "Request a Quote",
      showInNav: false,
      sortOrder: 7,
      sections: [
        { type: "page_header", props: { heading: "Request a quote", subheading: "Tell us about the job; we'll reply with a clear, itemised quote." } },
        { type: "quote_form", props: { formSlug: "quote-request", showServices: true } },
      ],
    },
  ];
}

export interface FormFieldSeed {
  id: string;
  key: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  width?: "full" | "half";
}

export function defaultForms(info: BusinessSeedInfo, leadQuestions: FormFieldSeed[]) {
  const base: FormFieldSeed[] = [
    { id: "name", key: "name", type: "text", label: "Your name", required: true, width: "half" },
    { id: "phone", key: "phone", type: "phone", label: "Phone", required: true, width: "half" },
    { id: "email", key: "email", type: "email", label: "Email", required: true },
  ];
  return [
    {
      slug: "contact",
      name: "Contact form",
      action: "CONTACT" as const,
      fields: [...base, { id: "message", key: "message", type: "textarea", label: "How can we help?", required: true }],
      settings: { submitLabel: "Send message", successMessage: `Thanks! ${info.name} will be in touch shortly.` },
    },
    {
      slug: "quote-request",
      name: "Quote request",
      action: "QUOTE_REQUEST" as const,
      fields: [
        ...base,
        { id: "address", key: "address", type: "address", label: "Job address" },
        { id: "service", key: "serviceId", type: "service", label: "Service", required: true },
        ...leadQuestions,
        { id: "message", key: "message", type: "textarea", label: "Describe the job", required: true },
        { id: "photos", key: "photos", type: "photo", label: "Photos (optional)", helpText: "Up to 6 photos help us quote accurately." },
      ],
      settings: { submitLabel: "Request quote", successMessage: "Thanks! We'll review the details and come back with a quote." },
    },
  ];
}

export interface NavItemSeed {
  id: string;
  label: string;
  href?: string;
  pageSystemKey?: string;
  children?: NavItemSeed[];
  type?: "page" | "link" | "services" | "dropdown";
}

export function defaultNavigation(info: BusinessSeedInfo): { header: NavItemSeed[]; footer: NavItemSeed[] } {
  const services = t(info, "services", "Services");
  const projects = t(info, "projects", "Projects");
  return {
    header: [
      { id: "home", label: "Home", pageSystemKey: "home", type: "page" },
      { id: "services", label: services, pageSystemKey: "services", type: "services" },
      { id: "projects", label: projects, pageSystemKey: "projects", type: "page" },
      { id: "about", label: "About", pageSystemKey: "about", type: "page" },
      { id: "areas", label: "Areas", pageSystemKey: "areas", type: "page" },
      { id: "contact", label: "Contact", pageSystemKey: "contact", type: "page" },
      { id: "quote", label: "Get a quote", pageSystemKey: "quote", type: "page" },
    ],
    footer: [
      { id: "f-services", label: services, pageSystemKey: "services", type: "services" },
      { id: "f-projects", label: projects, pageSystemKey: "projects", type: "page" },
      { id: "f-reviews", label: "Reviews", pageSystemKey: "reviews", type: "page" },
      { id: "f-areas", label: "Service areas", pageSystemKey: "areas", type: "page" },
      { id: "f-contact", label: "Contact", pageSystemKey: "contact", type: "page" },
    ],
  };
}
