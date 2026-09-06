import type { SectionSeed } from "@/lib/blocks/schema";

/**
 * Seed data for system industries. Once seeded these are ordinary rows the
 * platform owner edits from Super Admin → Industries; new industries are
 * created there, never here. This file only bootstraps a fresh install.
 */
export interface IndustryServiceSeed {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  pricingMethod?: "QUOTE" | "FIXED" | "RANGE" | "HOURLY" | "DAY_RATE" | "PER_SQM" | "PER_UNIT" | "PER_LINEAR_METRE";
  priceMinCents?: number;
  priceMaxCents?: number;
  priceUnit?: string;
  faqs?: Array<{ question: string; answer: string }>;
  children?: IndustryServiceSeed[];
}

export interface IndustryFieldSeed {
  key: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "NUMBER" | "MEASUREMENT" | "SELECT" | "MULTISELECT" | "BOOLEAN" | "DATE" | "MEDIA" | "ADDRESS";
  options?: Array<{ value: string; label: string }>;
  isRequired?: boolean;
  helpText?: string;
  groupName?: string;
  showOnForms?: boolean;
  unit?: string;
}

export interface IndustryPricingSeed {
  key: string;
  label: string;
  type: "RATE" | "FEE" | "MULTIPLIER" | "PERCENT";
  amount: number;
  unit?: string;
  category?: string;
  description?: string;
}

export interface IndustryStageSeed {
  key: string;
  name: string;
  color?: string;
  description?: string;
  isTerminal?: boolean;
}

export interface IndustrySeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
  terminology?: Record<string, string>;
  defaultServices?: IndustryServiceSeed[];
  jobFields?: IndustryFieldSeed[];
  estimateFields?: IndustryFieldSeed[];
  pricingFields?: IndustryPricingSeed[];
  websiteSections?: Record<string, SectionSeed[]>;
  leadQuestions?: IndustryFieldSeed[];
  projectStages?: IndustryStageSeed[];
  defaultFeatures?: string[];
}

const GENERIC_STAGES: IndustryStageSeed[] = [
  { key: "lead", name: "Lead", color: "#64748b" },
  { key: "site_visit", name: "Site Visit", color: "#0ea5e9" },
  { key: "quote", name: "Quote", color: "#8b5cf6" },
  { key: "accepted", name: "Accepted", color: "#22c55e" },
  { key: "deposit", name: "Deposit", color: "#16a34a" },
  { key: "scheduled", name: "Scheduled", color: "#f59e0b" },
  { key: "in_progress", name: "In Progress", color: "#f97316" },
  { key: "completion", name: "Completion", color: "#10b981", isTerminal: true },
];

const GENERIC_PRICING: IndustryPricingSeed[] = [
  { key: "labour_hourly", label: "Labour rate (hourly)", type: "RATE", amount: 95, unit: "hour", category: "labour" },
  { key: "labour_day", label: "Day rate", type: "RATE", amount: 720, unit: "day", category: "labour" },
  { key: "minimum_charge", label: "Minimum charge", type: "FEE", amount: 180, category: "fees" },
  { key: "travel_fee", label: "Travel fee", type: "FEE", amount: 45, category: "fees", description: "Applied outside the primary service area." },
  { key: "materials_markup", label: "Materials markup", type: "PERCENT", amount: 15, category: "materials" },
  { key: "margin", label: "Target margin", type: "PERCENT", amount: 20, category: "business" },
];

const GENERIC_LEAD_QUESTIONS: IndustryFieldSeed[] = [
  { key: "property_type", label: "Property type", type: "SELECT", options: [{ value: "residential", label: "Residential" }, { value: "commercial", label: "Commercial" }, { value: "strata", label: "Strata / body corporate" }], showOnForms: true },
  { key: "timeframe", label: "When do you need this done?", type: "SELECT", options: [{ value: "asap", label: "As soon as possible" }, { value: "1_month", label: "Within a month" }, { value: "3_months", label: "In the next 3 months" }, { value: "planning", label: "Just planning" }], showOnForms: true },
];

function generic(slug: string, name: string, description: string, icon: string, services: IndustryServiceSeed[], extra: Partial<IndustrySeed> = {}): IndustrySeed {
  return {
    slug,
    name,
    description,
    icon,
    terminology: { service: "Service", project: "Project", quote: "Quote", job: "Job", customer: "Customer", lead: "Enquiry", ...(extra.terminology ?? {}) },
    defaultServices: services,
    jobFields: extra.jobFields ?? [],
    estimateFields: extra.estimateFields ?? [{ key: "area_sqm", label: "Approximate area", type: "MEASUREMENT", unit: "m²", showOnForms: true }],
    pricingFields: [...GENERIC_PRICING, ...(extra.pricingFields ?? [])],
    websiteSections: extra.websiteSections ?? {},
    leadQuestions: [...GENERIC_LEAD_QUESTIONS, ...(extra.leadQuestions ?? [])],
    projectStages: extra.projectStages ?? GENERIC_STAGES,
    defaultFeatures: extra.defaultFeatures ?? ["website", "projects", "reviews", "service_areas", "quote_requests", "crm", "quotes", "jobs", "automations", "analytics"],
  };
}

export const INDUSTRY_CATALOG: IndustrySeed[] = [
  generic("tiling", "Tiling", "Wall and floor tiling, waterproofing and stone finishing.", "grid", [
    { name: "Bathroom Tiling", shortDescription: "Floor-to-ceiling bathroom tiling with certified waterproofing.", pricingMethod: "PER_SQM", priceMinCents: 8500, priceMaxCents: 16000, priceUnit: "m²", faqs: [{ question: "Do you handle waterproofing?", answer: "Yes. Every wet area is waterproofed to AS 3740 and certified before tiling begins." }] },
    { name: "Kitchen Splashbacks", shortDescription: "Feature splashbacks in ceramic, porcelain, mosaic and natural stone.", pricingMethod: "RANGE", priceMinCents: 60000, priceMaxCents: 220000 },
    { name: "Floor Tiling", shortDescription: "Porcelain and ceramic floors for living areas, kitchens and outdoors.", pricingMethod: "PER_SQM", priceMinCents: 6500, priceMaxCents: 12000, priceUnit: "m²" },
    { name: "Large Format Tiles", shortDescription: "Specialist installation of 1200mm+ porcelain slabs.", pricingMethod: "PER_SQM", priceMinCents: 11000, priceMaxCents: 22000, priceUnit: "m²" },
    { name: "Outdoor & Pool Tiling", shortDescription: "Alfresco, patio and pool surrounds with slip-rated finishes.", pricingMethod: "PER_SQM", priceMinCents: 9000, priceMaxCents: 18000, priceUnit: "m²" },
    { name: "Waterproofing", shortDescription: "Certified wet-area waterproofing to Australian Standards.", pricingMethod: "QUOTE" },
    { name: "Tile Removal & Preparation", shortDescription: "Demolition, screeding and levelling before new tiles.", pricingMethod: "PER_SQM", priceMinCents: 3500, priceMaxCents: 7000, priceUnit: "m²" },
  ], {
    terminology: { project: "Project", job: "Job", quote: "Quote" },
    jobFields: [
      { key: "tile_size", label: "Tile size", type: "SELECT", options: [{ value: "small", label: "Under 300mm" }, { value: "standard", label: "300–600mm" }, { value: "large", label: "600–1200mm" }, { value: "xl", label: "Over 1200mm (large format)" }], groupName: "Tiles", showOnForms: true },
      { key: "tile_material", label: "Tile material", type: "SELECT", options: [{ value: "ceramic", label: "Ceramic" }, { value: "porcelain", label: "Porcelain" }, { value: "natural_stone", label: "Natural stone" }, { value: "mosaic", label: "Mosaic" }, { value: "terrazzo", label: "Terrazzo" }], groupName: "Tiles", showOnForms: true },
      { key: "grout", label: "Grout type", type: "SELECT", options: [{ value: "cement", label: "Cement" }, { value: "epoxy", label: "Epoxy" }], groupName: "Finish" },
      { key: "pattern", label: "Laying pattern", type: "SELECT", options: [{ value: "stack", label: "Stack bond" }, { value: "brick", label: "Brick / offset" }, { value: "herringbone", label: "Herringbone" }, { value: "diagonal", label: "Diagonal" }], groupName: "Finish" },
      { key: "waterproofing_required", label: "Waterproofing required", type: "BOOLEAN", groupName: "Preparation" },
    ],
    estimateFields: [
      { key: "area_sqm", label: "Area to tile", type: "MEASUREMENT", unit: "m²", isRequired: true, showOnForms: true },
      { key: "tile_size_mm", label: "Tile size (longest edge, mm)", type: "NUMBER", showOnForms: true },
      { key: "demolition", label: "Remove existing tiles", type: "BOOLEAN", showOnForms: true },
      { key: "waterproofing", label: "Wet area waterproofing", type: "BOOLEAN", showOnForms: true },
    ],
    pricingFields: [
      { key: "rate_sqm", label: "Tiling rate", type: "RATE", amount: 85, unit: "m²", category: "labour" },
      { key: "demolition_sqm", label: "Demolition & removal", type: "RATE", amount: 35, unit: "m²", category: "preparation" },
      { key: "preparation_sqm", label: "Screed / levelling", type: "RATE", amount: 28, unit: "m²", category: "preparation" },
      { key: "waterproofing_sqm", label: "Waterproofing", type: "RATE", amount: 45, unit: "m²", category: "preparation" },
      { key: "grouting_sqm", label: "Grouting & sealing", type: "RATE", amount: 12, unit: "m²", category: "finish" },
      { key: "large_format_multiplier", label: "Large-format multiplier", type: "MULTIPLIER", amount: 1.25, category: "complexity", description: "Applied when the tile edge exceeds 1200mm." },
      { key: "complexity_multiplier", label: "Complexity multiplier", type: "MULTIPLIER", amount: 1.0, category: "complexity" },
    ],
    projectStages: [
      { key: "lead", name: "Lead", color: "#64748b" },
      { key: "site_visit", name: "Site Visit", color: "#0ea5e9" },
      { key: "quote", name: "Quote", color: "#8b5cf6" },
      { key: "accepted", name: "Accepted", color: "#22c55e" },
      { key: "deposit", name: "Deposit", color: "#16a34a" },
      { key: "demolition", name: "Demolition", color: "#ef4444" },
      { key: "preparation", name: "Preparation", color: "#f59e0b" },
      { key: "waterproofing", name: "Waterproofing", color: "#06b6d4" },
      { key: "tiling", name: "Tiling", color: "#f97316" },
      { key: "grouting", name: "Grouting", color: "#a855f7" },
      { key: "completion", name: "Completion", color: "#10b981", isTerminal: true },
    ],
    defaultFeatures: ["website", "projects", "reviews", "service_areas", "quote_requests", "calculator", "crm", "quotes", "jobs", "automations", "analytics"],
  }),
  generic("stone", "Stone", "Natural stone supply, benchtops, cladding and restoration.", "mountain", [
    { name: "Stone Benchtops", shortDescription: "Marble, granite and engineered stone benchtops templated and installed.", pricingMethod: "QUOTE" },
    { name: "Stone Cladding", shortDescription: "Feature walls, façades and fireplaces in natural stone.", pricingMethod: "PER_SQM", priceMinCents: 18000, priceMaxCents: 45000, priceUnit: "m²" },
    { name: "Stone Restoration", shortDescription: "Honing, polishing and sealing of worn stone surfaces.", pricingMethod: "PER_SQM", priceMinCents: 6000, priceMaxCents: 15000, priceUnit: "m²" },
  ], { jobFields: [{ key: "stone_type", label: "Stone type", type: "SELECT", options: [{ value: "marble", label: "Marble" }, { value: "granite", label: "Granite" }, { value: "limestone", label: "Limestone" }, { value: "travertine", label: "Travertine" }, { value: "engineered", label: "Engineered" }], showOnForms: true }, { key: "finish", label: "Finish", type: "SELECT", options: [{ value: "polished", label: "Polished" }, { value: "honed", label: "Honed" }, { value: "leathered", label: "Leathered" }] }] }),
  generic("bathroom-renovation", "Bathroom Renovation", "Complete bathroom design and renovation.", "bath", [
    { name: "Full Bathroom Renovation", shortDescription: "Design to completion: demolition, plumbing, tiling, fit-off.", pricingMethod: "RANGE", priceMinCents: 1800000, priceMaxCents: 4500000 },
    { name: "Ensuite Renovation", shortDescription: "Compact ensuite makeovers.", pricingMethod: "RANGE", priceMinCents: 1200000, priceMaxCents: 3000000 },
    { name: "Laundry Renovation", shortDescription: "Functional laundry redesigns.", pricingMethod: "RANGE", priceMinCents: 800000, priceMaxCents: 2000000 },
  ], { jobFields: [{ key: "bathroom_count", label: "Number of bathrooms", type: "NUMBER", showOnForms: true }, { key: "layout_change", label: "Layout change required", type: "BOOLEAN", showOnForms: true }] }),
  generic("plumbing", "Plumbing", "Residential and commercial plumbing, gas and hot water.", "wrench", [
    { name: "Emergency Plumbing", shortDescription: "24/7 burst pipes, blocked drains and leaks.", pricingMethod: "HOURLY", priceMinCents: 15000, priceUnit: "hour" },
    { name: "Blocked Drains", shortDescription: "CCTV inspection, jetting and drain repair.", pricingMethod: "RANGE", priceMinCents: 25000, priceMaxCents: 90000 },
    { name: "Hot Water Systems", shortDescription: "Supply, install and replace gas, electric, solar and heat-pump units.", pricingMethod: "RANGE", priceMinCents: 150000, priceMaxCents: 550000 },
    { name: "Gas Fitting", shortDescription: "Licensed gas appliance installation and compliance.", pricingMethod: "QUOTE" },
    { name: "Bathroom & Kitchen Plumbing", shortDescription: "Rough-in and fit-off for renovations.", pricingMethod: "QUOTE" },
    { name: "Leak Detection", shortDescription: "Acoustic and thermal leak location.", pricingMethod: "FIXED", priceMinCents: 35000 },
  ], {
    terminology: { project: "Job", job: "Job", quote: "Quote", lead: "Call-out" },
    jobFields: [
      { key: "fixture_type", label: "Fixture type", type: "SELECT", options: [{ value: "tap", label: "Tap / mixer" }, { value: "toilet", label: "Toilet" }, { value: "shower", label: "Shower" }, { value: "sink", label: "Sink / basin" }, { value: "hws", label: "Hot water system" }, { value: "drain", label: "Drain" }], showOnForms: true },
      { key: "pipe_type", label: "Pipe type", type: "SELECT", options: [{ value: "copper", label: "Copper" }, { value: "pex", label: "PEX" }, { value: "pvc", label: "PVC" }, { value: "galvanised", label: "Galvanised" }] },
      { key: "hot_water_type", label: "Hot water type", type: "SELECT", options: [{ value: "gas", label: "Gas" }, { value: "electric", label: "Electric" }, { value: "solar", label: "Solar" }, { value: "heat_pump", label: "Heat pump" }] },
      { key: "emergency", label: "Emergency call-out", type: "BOOLEAN", showOnForms: true },
    ],
    estimateFields: [{ key: "urgency", label: "Urgency", type: "SELECT", options: [{ value: "emergency", label: "Emergency (today)" }, { value: "this_week", label: "This week" }, { value: "flexible", label: "Flexible" }], showOnForms: true }],
    pricingFields: [
      { key: "call_out_fee", label: "Call-out fee", type: "FEE", amount: 120, category: "fees" },
      { key: "after_hours_multiplier", label: "After-hours multiplier", type: "MULTIPLIER", amount: 1.5, category: "complexity" },
      { key: "drain_jetting", label: "Drain jetting (per hour)", type: "RATE", amount: 220, unit: "hour", category: "labour" },
    ],
    projectStages: [
      { key: "lead", name: "Call-out", color: "#64748b" },
      { key: "inspection", name: "Inspection", color: "#0ea5e9" },
      { key: "quote", name: "Quote", color: "#8b5cf6" },
      { key: "accepted", name: "Accepted", color: "#22c55e" },
      { key: "parts", name: "Parts Ordered", color: "#f59e0b" },
      { key: "works", name: "Works", color: "#f97316" },
      { key: "compliance", name: "Compliance Certificate", color: "#06b6d4" },
      { key: "completion", name: "Completion", color: "#10b981", isTerminal: true },
    ],
    defaultFeatures: ["website", "projects", "reviews", "service_areas", "quote_requests", "online_booking", "crm", "quotes", "jobs", "invoices", "automations", "analytics"],
  }),
  generic("electrical", "Electrical", "Licensed electrical installation, repair and compliance.", "zap", [
    { name: "Switchboard Upgrades", shortDescription: "Modern switchboards with RCD protection.", pricingMethod: "RANGE", priceMinCents: 120000, priceMaxCents: 350000 },
    { name: "Lighting Installation", shortDescription: "LED downlights, feature and outdoor lighting.", pricingMethod: "PER_UNIT", priceMinCents: 9000, priceUnit: "point" },
    { name: "Power Points & Circuits", shortDescription: "New circuits, outlets and appliance connections.", pricingMethod: "PER_UNIT", priceMinCents: 15000, priceUnit: "point" },
    { name: "EV Charger Installation", shortDescription: "Home and commercial EV charging.", pricingMethod: "RANGE", priceMinCents: 150000, priceMaxCents: 400000 },
    { name: "Safety Inspections", shortDescription: "Electrical safety checks and certificates.", pricingMethod: "FIXED", priceMinCents: 25000 },
  ], {
    jobFields: [
      { key: "voltage", label: "Voltage", type: "SELECT", options: [{ value: "single", label: "Single phase (240V)" }, { value: "three", label: "Three phase (415V)" }], showOnForms: true },
      { key: "circuit_type", label: "Circuit type", type: "SELECT", options: [{ value: "lighting", label: "Lighting" }, { value: "power", label: "Power" }, { value: "dedicated", label: "Dedicated appliance" }, { value: "sub_main", label: "Sub-main" }] },
      { key: "switchboard", label: "Switchboard condition", type: "SELECT", options: [{ value: "modern", label: "Modern (RCD)" }, { value: "ceramic", label: "Ceramic fuses" }, { value: "unknown", label: "Unknown" }], showOnForms: true },
    ],
    pricingFields: [{ key: "point_rate", label: "Rate per point", type: "RATE", amount: 110, unit: "point", category: "labour" }, { key: "compliance_cert", label: "Certificate of compliance", type: "FEE", amount: 65, category: "fees" }],
  }),
  generic("building", "Building", "Residential builders: extensions, renovations and new homes.", "home", [
    { name: "Home Extensions", shortDescription: "Ground floor and second storey extensions.", pricingMethod: "QUOTE" },
    { name: "Renovations", shortDescription: "Whole-home and structural renovations.", pricingMethod: "QUOTE" },
    { name: "New Builds", shortDescription: "Custom new home construction.", pricingMethod: "QUOTE" },
    { name: "Decks & Pergolas", shortDescription: "Outdoor living structures.", pricingMethod: "PER_SQM", priceMinCents: 45000, priceMaxCents: 90000, priceUnit: "m²" },
  ], { projectStages: [{ key: "lead", name: "Lead" }, { key: "consult", name: "Consultation" }, { key: "design", name: "Design & Approvals" }, { key: "quote", name: "Quote" }, { key: "contract", name: "Contract" }, { key: "construction", name: "Construction" }, { key: "handover", name: "Handover", isTerminal: true }] }),
  generic("roofing", "Roofing", "Roof replacement, repairs, gutters and restoration.", "warehouse", [
    { name: "Roof Replacement", shortDescription: "Tile-to-metal conversions and full re-roofs.", pricingMethod: "PER_SQM", priceMinCents: 9000, priceMaxCents: 18000, priceUnit: "m²" },
    { name: "Roof Repairs", shortDescription: "Leaks, broken tiles, flashing and ridge capping.", pricingMethod: "RANGE", priceMinCents: 35000, priceMaxCents: 250000 },
    { name: "Gutters & Downpipes", shortDescription: "Replacement and gutter guard.", pricingMethod: "PER_LINEAR_METRE", priceMinCents: 6500, priceMaxCents: 12000, priceUnit: "lm" },
    { name: "Roof Restoration", shortDescription: "Clean, repair, seal and recoat.", pricingMethod: "PER_SQM", priceMinCents: 4500, priceMaxCents: 8000, priceUnit: "m²" },
  ], {
    jobFields: [{ key: "roof_type", label: "Roof type", type: "SELECT", options: [{ value: "tile", label: "Tile" }, { value: "metal", label: "Metal" }, { value: "slate", label: "Slate" }, { value: "flat", label: "Flat / membrane" }], showOnForms: true }, { key: "storeys", label: "Storeys", type: "NUMBER", showOnForms: true }],
    projectStages: [{ key: "lead", name: "Lead" }, { key: "inspection", name: "Inspection" }, { key: "quote", name: "Quote" }, { key: "accepted", name: "Accepted" }, { key: "material_order", name: "Material Order" }, { key: "removal", name: "Removal" }, { key: "installation", name: "Installation" }, { key: "final_inspection", name: "Inspection" }, { key: "completion", name: "Completion", isTerminal: true }],
    pricingFields: [{ key: "height_multiplier", label: "Two-storey multiplier", type: "MULTIPLIER", amount: 1.2, category: "complexity" }, { key: "scaffold_fee", label: "Scaffolding", type: "FEE", amount: 1800, category: "fees" }],
  }),
  generic("painting", "Painting", "Interior and exterior painting and decorating.", "paintbrush", [
    { name: "Interior Painting", shortDescription: "Walls, ceilings, trims and feature finishes.", pricingMethod: "PER_SQM", priceMinCents: 1800, priceMaxCents: 3500, priceUnit: "m²" },
    { name: "Exterior Painting", shortDescription: "Weatherboard, render and brick exteriors.", pricingMethod: "PER_SQM", priceMinCents: 2500, priceMaxCents: 4500, priceUnit: "m²" },
    { name: "Commercial Painting", shortDescription: "Offices, retail and strata.", pricingMethod: "QUOTE" },
  ], { jobFields: [{ key: "rooms", label: "Number of rooms", type: "NUMBER", showOnForms: true }, { key: "surface", label: "Surface condition", type: "SELECT", options: [{ value: "good", label: "Good" }, { value: "fair", label: "Some repairs" }, { value: "poor", label: "Extensive prep" }] }] }),
  generic("landscaping", "Landscaping", "Garden design, construction and maintenance.", "trees", [
    { name: "Landscape Design", shortDescription: "Concept and construction plans.", pricingMethod: "RANGE", priceMinCents: 150000, priceMaxCents: 600000 },
    { name: "Garden Construction", shortDescription: "Paving, retaining walls, planting and irrigation.", pricingMethod: "QUOTE" },
    { name: "Turf & Artificial Grass", shortDescription: "Supply and lay.", pricingMethod: "PER_SQM", priceMinCents: 3500, priceMaxCents: 9500, priceUnit: "m²" },
    { name: "Garden Maintenance", shortDescription: "Regular garden care.", pricingMethod: "HOURLY", priceMinCents: 7500, priceUnit: "hour" },
  ]),
  generic("concreting", "Concreting", "Driveways, slabs, exposed aggregate and polished concrete.", "square", [
    { name: "Driveways", shortDescription: "Plain, coloured and exposed aggregate driveways.", pricingMethod: "PER_SQM", priceMinCents: 9000, priceMaxCents: 16000, priceUnit: "m²" },
    { name: "House Slabs", shortDescription: "Engineered slabs for new builds and extensions.", pricingMethod: "QUOTE" },
    { name: "Polished Concrete", shortDescription: "Mechanically polished floors.", pricingMethod: "PER_SQM", priceMinCents: 8000, priceMaxCents: 15000, priceUnit: "m²" },
  ], { jobFields: [{ key: "finish", label: "Finish", type: "SELECT", options: [{ value: "plain", label: "Plain" }, { value: "coloured", label: "Coloured" }, { value: "exposed", label: "Exposed aggregate" }, { value: "polished", label: "Polished" }], showOnForms: true }, { key: "thickness_mm", label: "Thickness (mm)", type: "NUMBER" }] }),
  generic("carpentry", "Carpentry", "Structural and finishing carpentry.", "hammer", [
    { name: "Decking", shortDescription: "Timber and composite decks.", pricingMethod: "PER_SQM", priceMinCents: 35000, priceMaxCents: 75000, priceUnit: "m²" },
    { name: "Framing", shortDescription: "Wall, floor and roof framing.", pricingMethod: "QUOTE" },
    { name: "Doors & Windows", shortDescription: "Supply and install.", pricingMethod: "PER_UNIT", priceMinCents: 45000, priceUnit: "unit" },
    { name: "Custom Joinery", shortDescription: "Built-ins and bespoke timber work.", pricingMethod: "QUOTE" },
  ]),
  generic("flooring", "Flooring", "Timber, laminate, vinyl and hybrid flooring.", "layers", [
    { name: "Timber Flooring", shortDescription: "Solid and engineered timber supply and install.", pricingMethod: "PER_SQM", priceMinCents: 9000, priceMaxCents: 20000, priceUnit: "m²" },
    { name: "Hybrid & Vinyl Plank", shortDescription: "Waterproof floating floors.", pricingMethod: "PER_SQM", priceMinCents: 5500, priceMaxCents: 9500, priceUnit: "m²" },
    { name: "Floor Sanding & Polishing", shortDescription: "Restore existing timber floors.", pricingMethod: "PER_SQM", priceMinCents: 3500, priceMaxCents: 6000, priceUnit: "m²" },
  ]),
  generic("rendering", "Rendering", "Cement, acrylic and texture rendering.", "brick-wall", [
    { name: "Cement Rendering", shortDescription: "Traditional sand and cement render.", pricingMethod: "PER_SQM", priceMinCents: 4500, priceMaxCents: 7500, priceUnit: "m²" },
    { name: "Acrylic Rendering", shortDescription: "Flexible acrylic finishes for Hebel and blueboard.", pricingMethod: "PER_SQM", priceMinCents: 5500, priceMaxCents: 9000, priceUnit: "m²" },
    { name: "Texture Coating", shortDescription: "Decorative finishes and colour coats.", pricingMethod: "PER_SQM", priceMinCents: 3000, priceMaxCents: 5000, priceUnit: "m²" },
  ]),
  generic("solar", "Solar", "Solar panels, batteries and energy systems.", "sun", [
    { name: "Residential Solar", shortDescription: "6.6kW to 13kW systems designed for your roof.", pricingMethod: "RANGE", priceMinCents: 450000, priceMaxCents: 1400000 },
    { name: "Battery Storage", shortDescription: "Home batteries and backup.", pricingMethod: "RANGE", priceMinCents: 900000, priceMaxCents: 2000000 },
    { name: "Commercial Solar", shortDescription: "30kW+ commercial installations.", pricingMethod: "QUOTE" },
  ], { jobFields: [{ key: "system_kw", label: "System size (kW)", type: "NUMBER", showOnForms: true }, { key: "roof_type", label: "Roof type", type: "SELECT", options: [{ value: "tile", label: "Tile" }, { value: "metal", label: "Metal" }, { value: "flat", label: "Flat" }], showOnForms: true }, { key: "phase", label: "Supply phase", type: "SELECT", options: [{ value: "single", label: "Single" }, { value: "three", label: "Three" }] }] }),
  generic("hvac", "HVAC", "Heating, ventilation and air conditioning.", "wind", [
    { name: "Split System Installation", shortDescription: "Supply and install wall-mounted splits.", pricingMethod: "RANGE", priceMinCents: 180000, priceMaxCents: 450000 },
    { name: "Ducted Air Conditioning", shortDescription: "Whole-home reverse cycle ducted systems.", pricingMethod: "RANGE", priceMinCents: 900000, priceMaxCents: 2500000 },
    { name: "Servicing & Repairs", shortDescription: "Maintenance, regas and repairs.", pricingMethod: "FIXED", priceMinCents: 18000 },
  ], { jobFields: [{ key: "unit_type", label: "Unit type", type: "SELECT", options: [{ value: "split", label: "Split" }, { value: "ducted", label: "Ducted" }, { value: "evaporative", label: "Evaporative" }], showOnForms: true }, { key: "capacity_kw", label: "Capacity (kW)", type: "NUMBER" }] }),
  generic("cleaning", "Cleaning", "Residential, commercial and end-of-lease cleaning.", "sparkles", [
    { name: "End of Lease Cleaning", shortDescription: "Bond-back guaranteed cleans.", pricingMethod: "RANGE", priceMinCents: 25000, priceMaxCents: 80000 },
    { name: "Regular Home Cleaning", shortDescription: "Weekly and fortnightly cleans.", pricingMethod: "HOURLY", priceMinCents: 5500, priceUnit: "hour" },
    { name: "Commercial Cleaning", shortDescription: "Offices, medical and retail.", pricingMethod: "QUOTE" },
  ], { jobFields: [{ key: "bedrooms", label: "Bedrooms", type: "NUMBER", showOnForms: true }, { key: "bathrooms", label: "Bathrooms", type: "NUMBER", showOnForms: true }], projectStages: [{ key: "lead", name: "Enquiry" }, { key: "quote", name: "Quote" }, { key: "booked", name: "Booked" }, { key: "in_progress", name: "In Progress" }, { key: "completion", name: "Complete", isTerminal: true }] }),
  generic("demolition", "Demolition", "Structural, interior and site demolition.", "bomb", [
    { name: "House Demolition", shortDescription: "Full structure demolition and site clear.", pricingMethod: "QUOTE" },
    { name: "Interior Strip-outs", shortDescription: "Kitchens, bathrooms and commercial fit-outs.", pricingMethod: "RANGE", priceMinCents: 150000, priceMaxCents: 800000 },
    { name: "Asbestos Removal", shortDescription: "Licensed asbestos removal and disposal.", pricingMethod: "QUOTE" },
  ], { jobFields: [{ key: "asbestos_present", label: "Asbestos present", type: "SELECT", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Unknown" }], showOnForms: true }] }),
  generic("cabinetry", "Cabinetry", "Kitchens, wardrobes and custom cabinetry.", "box", [
    { name: "Kitchen Cabinetry", shortDescription: "Custom kitchens designed and installed.", pricingMethod: "RANGE", priceMinCents: 1500000, priceMaxCents: 5000000 },
    { name: "Wardrobes", shortDescription: "Walk-in and built-in wardrobes.", pricingMethod: "RANGE", priceMinCents: 300000, priceMaxCents: 1200000 },
    { name: "Vanities & Laundry", shortDescription: "Custom vanities and laundry storage.", pricingMethod: "RANGE", priceMinCents: 200000, priceMaxCents: 800000 },
  ]),
  generic("glass", "Glass", "Glazing, shower screens, balustrades and splashbacks.", "app-window", [
    { name: "Shower Screens", shortDescription: "Frameless and semi-frameless screens.", pricingMethod: "RANGE", priceMinCents: 90000, priceMaxCents: 250000 },
    { name: "Glass Balustrades", shortDescription: "Pool and balcony balustrades.", pricingMethod: "PER_LINEAR_METRE", priceMinCents: 45000, priceMaxCents: 90000, priceUnit: "lm" },
    { name: "Emergency Glass Repair", shortDescription: "24/7 broken window replacement.", pricingMethod: "QUOTE" },
  ]),
  generic("pools", "Pools", "Pool construction, renovation and maintenance.", "waves", [
    { name: "Concrete Pools", shortDescription: "Custom designed concrete pools.", pricingMethod: "QUOTE" },
    { name: "Fibreglass Pools", shortDescription: "Fast-install fibreglass pools.", pricingMethod: "RANGE", priceMinCents: 3500000, priceMaxCents: 8000000 },
    { name: "Pool Renovation", shortDescription: "Resurfacing, tiling and equipment upgrades.", pricingMethod: "QUOTE" },
    { name: "Pool Servicing", shortDescription: "Regular cleaning and chemical balancing.", pricingMethod: "FIXED", priceMinCents: 12000 },
  ], { projectStages: [{ key: "lead", name: "Lead" }, { key: "design", name: "Design" }, { key: "quote", name: "Quote" }, { key: "approvals", name: "Approvals" }, { key: "excavation", name: "Excavation" }, { key: "shell", name: "Shell" }, { key: "finishing", name: "Finishing" }, { key: "handover", name: "Handover", isTerminal: true }] }),
  generic("property-maintenance", "Property Maintenance", "Handyman and property maintenance services.", "wrench", [
    { name: "General Handyman", shortDescription: "Repairs, installs and odd jobs.", pricingMethod: "HOURLY", priceMinCents: 8500, priceUnit: "hour" },
    { name: "Strata Maintenance", shortDescription: "Scheduled maintenance for body corporates.", pricingMethod: "QUOTE" },
    { name: "Pre-sale Preparation", shortDescription: "Get a property market-ready.", pricingMethod: "QUOTE" },
  ]),
  generic("custom", "Custom Trade", "Starting point for any trade not listed. Rename and configure in Super Admin.", "settings", [
    { name: "Primary Service", shortDescription: "Describe your main service.", pricingMethod: "QUOTE" },
    { name: "Secondary Service", shortDescription: "Describe another service you offer.", pricingMethod: "QUOTE" },
  ]),
];
