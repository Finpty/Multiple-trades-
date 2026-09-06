import { platformDb, prisma, tenantDb } from "@/lib/db";
import { toJson } from "@/lib/json";
import { createBusiness } from "./create";
import { publishBusiness } from "./publish";

/**
 * Demo tenants. They are created through exactly the same service functions
 * the Super Admin "Create Business" wizard calls — there is no special-casing
 * for either company anywhere in the platform code.
 */
export async function seedDemoBusinesses(ownerUserId: string): Promise<string[]> {
  const created: string[] = [];

  const existingKabura = await prisma.business.findUnique({ where: { slug: "kabura" } });
  if (!existingKabura) {
    const tiling = await prisma.industry.findUniqueOrThrow({ where: { slug: "tiling" } });
    const kabura = await createBusiness({
      industryId: tiling.id,
      name: "Kabura Tiling",
      slug: "kabura",
      legalName: "Kabura Tiling Pty Ltd",
      tradingName: "Kabura Tiling",
      businessNumber: "12 345 678 901",
      tagline: "Precision tiling and stone for homes that deserve better.",
      description: "Kabura Tiling is a Perth-based team specialising in bathrooms, large-format porcelain and natural stone. We waterproof, prepare and tile to a standard that lasts.",
      phone: "08 6000 1234",
      email: "hello@kaburatiling.com.au",
      country: "AU",
      state: "WA",
      serviceAreaText: "Perth & surrounds",
      address: { line1: "12 Trade Street", city: "Osborne Park", state: "WA", postcode: "6017", country: "AU" },
      designFamilySlug: "minimal-luxury",
      themeOverrides: { colors: { primary: "#1c1917", secondary: "#57534e", accent: "#b45309", background: "#ffffff", surface: "#faf7f2", text: "#1c1917", muted: "#78716c", border: "#e7e5e4" } },
      serviceAreas: [
        { name: "Perth", type: "CITY", state: "WA", isPrimary: true },
        { name: "Subiaco", type: "SUBURB", postcode: "6008", state: "WA" },
        { name: "Cottesloe", type: "SUBURB", postcode: "6011", state: "WA" },
        { name: "Fremantle", type: "SUBURB", postcode: "6160", state: "WA" },
        { name: "Joondalup", type: "SUBURB", postcode: "6027", state: "WA" },
        { name: "Mandurah", type: "CITY", postcode: "6210", state: "WA" },
      ],
      ownerUserId,
      createdByUserId: ownerUserId,
    });
    await addDemoContent(kabura.id, "tiling");
    await publishBusiness(kabura.id, { actorUserId: ownerUserId });
    created.push(kabura.slug);
  }

  const existingPlumbing = await prisma.business.findUnique({ where: { slug: "elite-plumbing" } });
  if (!existingPlumbing) {
    const plumbing = await prisma.industry.findUniqueOrThrow({ where: { slug: "plumbing" } });
    const elite = await createBusiness({
      industryId: plumbing.id,
      name: "Elite Plumbing Perth",
      slug: "elite-plumbing",
      legalName: "Elite Plumbing Services Pty Ltd",
      businessNumber: "98 765 432 109",
      tagline: "Fast, licensed plumbers. Upfront pricing, 24/7.",
      description: "Elite Plumbing Perth handles emergencies, blocked drains, hot water and full renovation plumbing across the metro area. Licensed, insured and on time.",
      phone: "08 6000 9876",
      email: "team@eliteplumbingperth.com.au",
      country: "AU",
      state: "WA",
      serviceAreaText: "Perth metro",
      address: { line1: "48 Pipeline Road", city: "Welshpool", state: "WA", postcode: "6106", country: "AU" },
      designFamilySlug: "modern-tech",
      themeOverrides: { colors: { primary: "#0c4a6e", secondary: "#0369a1", accent: "#f97316", background: "#ffffff", surface: "#f0f9ff", text: "#0f172a", muted: "#64748b", border: "#e0f2fe" } },
      serviceAreas: [
        { name: "Perth", type: "CITY", state: "WA", isPrimary: true },
        { name: "Cannington", type: "SUBURB", postcode: "6107", state: "WA" },
        { name: "Victoria Park", type: "SUBURB", postcode: "6100", state: "WA" },
        { name: "Belmont", type: "SUBURB", postcode: "6104", state: "WA" },
        { name: "Armadale", type: "SUBURB", postcode: "6112", state: "WA" },
      ],
      ownerUserId,
      createdByUserId: ownerUserId,
    });
    await addDemoContent(elite.id, "plumbing");
    await publishBusiness(elite.id, { actorUserId: ownerUserId });
    created.push(elite.slug);
  }
  return created;
}

interface DemoProject {
  title: string;
  slug: string;
  summary: string;
  locationText: string;
  projectSize?: string;
  materials?: Array<{ name: string; type: string }>;
  challenges?: string;
  solutions?: string;
  testimonial?: string;
  testimonialAuthor?: string;
  isFeatured: boolean;
  serviceSlug: string;
  areaSlug: string;
}

/** Portfolio, reviews and team content for the demos. Media is attached later from the admin. */
async function addDemoContent(businessId: string, kind: "tiling" | "plumbing") {
  const db = tenantDb(businessId);
  const services = await db.service.findMany({ where: { businessId }, orderBy: { sortOrder: "asc" } });
  const areas = await db.serviceArea.findMany({ where: { businessId }, orderBy: { sortOrder: "asc" } });
  const projects: DemoProject[] =
    kind === "tiling"
      ? [
          { title: "Cottesloe ensuite in honed travertine", slug: "cottesloe-ensuite-travertine", summary: "Floor-to-ceiling 600x1200 travertine-look porcelain with a walk-in shower.", locationText: "Cottesloe, WA", projectSize: "14 m²", materials: [{ name: "Travertine-look porcelain", type: "tile" }, { name: "Epoxy grout", type: "grout" }], challenges: "Old slab was out of level by 18mm across the room.", solutions: "Self-levelling screed and full re-waterproofing before laying.", testimonial: "The finish is flawless — the lines are perfect and they left the place spotless.", testimonialAuthor: "Sarah M.", isFeatured: true, serviceSlug: "bathroom-tiling", areaSlug: "cottesloe" },
          { title: "Subiaco kitchen splashback in zellige", slug: "subiaco-zellige-splashback", summary: "Hand-made zellige tiles laid in a stack bond behind a 3m island.", locationText: "Subiaco, WA", projectSize: "6 m²", materials: [{ name: "Moroccan zellige", type: "tile" }], testimonial: "They took real care with the irregular tiles. Exactly the look we wanted.", testimonialAuthor: "Daniel & Priya", isFeatured: true, serviceSlug: "kitchen-splashbacks", areaSlug: "subiaco" },
          { title: "Fremantle alfresco in large-format porcelain", slug: "fremantle-alfresco-porcelain", summary: "1200x1200 slip-rated porcelain over 60 m² of alfresco and pool surround.", locationText: "Fremantle, WA", projectSize: "60 m²", materials: [{ name: "R11 porcelain", type: "tile" }], isFeatured: true, serviceSlug: "outdoor-and-pool-tiling", areaSlug: "fremantle" },
        ]
      : [
          { title: "Emergency burst pipe repair, Victoria Park", slug: "victoria-park-burst-pipe", summary: "Located and repaired a burst copper main under the slab within two hours of the call.", locationText: "Victoria Park, WA", testimonial: "Arrived in 40 minutes on a Sunday night. Can't thank them enough.", testimonialAuthor: "Tom R.", isFeatured: true, serviceSlug: "emergency-plumbing", areaSlug: "victoria-park" },
          { title: "Heat-pump hot water upgrade, Belmont", slug: "belmont-heat-pump-upgrade", summary: "Replaced a failed electric storage unit with a 270L heat pump and claimed the rebate for the customer.", locationText: "Belmont, WA", isFeatured: true, serviceSlug: "hot-water-systems", areaSlug: "belmont" },
          { title: "Full bathroom rough-in and fit-off, Cannington", slug: "cannington-bathroom-plumbing", summary: "Relocated the shower and vanity, new drainage and fixtures for a renovation.", locationText: "Cannington, WA", isFeatured: true, serviceSlug: "bathroom-and-kitchen-plumbing", areaSlug: "cannington" },
        ];
  for (const [i, p] of projects.entries()) {
    const service = services.find((s) => s.slug === p.serviceSlug) ?? services[0];
    const area = areas.find((a) => a.slug === p.areaSlug) ?? null;
    const project = await db.project.create({
      data: {
        businessId,
        title: p.title,
        slug: p.slug,
        summary: p.summary,
        description: p.summary,
        locationText: p.locationText,
        serviceAreaId: area?.id ?? null,
        projectSize: p.projectSize ?? null,
        materials: toJson(p.materials ?? []),
        challenges: p.challenges ?? null,
        solutions: p.solutions ?? null,
        testimonial: p.testimonial ?? null,
        testimonialAuthor: p.testimonialAuthor ?? null,
        status: "PUBLISHED",
        isFeatured: p.isFeatured,
        sortOrder: i,
        completionDate: new Date(Date.UTC(2026, 3 + i, 12)),
      },
    });
    if (service) await db.projectService.create({ data: { businessId, projectId: project.id, serviceId: service.id } });
    if (p.testimonial) {
      await db.review.create({ data: { businessId, projectId: project.id, serviceId: service?.id ?? null, authorName: p.testimonialAuthor ?? "Customer", rating: 5, body: p.testimonial, source: "Google", isFeatured: true, sortOrder: i } });
    }
  }
  const team = kind === "tiling"
    ? [{ name: "Amir Kabura", role: "Founder & Lead Tiler" }, { name: "Jess Whitfield", role: "Project Coordinator" }]
    : [{ name: "Mark Ellis", role: "Master Plumber" }, { name: "Chloe Nguyen", role: "Operations Manager" }];
  for (const [i, m] of team.entries()) await db.teamMember.create({ data: { businessId, name: m.name, role: m.role, sortOrder: i } });

  await platformDb.review.createMany({
    data: [
      { businessId, authorName: kind === "tiling" ? "Grace L." : "Ben K.", rating: 5, body: kind === "tiling" ? "Beautiful work on our laundry and bathroom. Meticulous prep and a perfect finish." : "Clear pricing before they started, no surprises. Fixed the drain the same day.", source: "Google", isFeatured: true, sortOrder: 10 },
      { businessId, authorName: kind === "tiling" ? "Owen P." : "Lisa H.", rating: 5, body: kind === "tiling" ? "Turned up when they said they would, every day. Recommend without hesitation." : "Polite, tidy and fast. Our new hot water system was installed the next morning.", source: "Facebook", isFeatured: false, sortOrder: 11 },
    ],
  });
}
