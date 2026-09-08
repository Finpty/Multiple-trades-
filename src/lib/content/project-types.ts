import type { ProjectMediaStage } from "@prisma/client";

/** Client-safe project constants (no database or image-processing imports). */
export const PROJECT_MEDIA_STAGES: Array<{ value: ProjectMediaStage; label: string; hint: string; kind: "IMAGE" | "VIDEO" }> = [
  { value: "BEFORE", label: "Before", hint: "How the site looked before work started.", kind: "IMAGE" },
  { value: "PROGRESS", label: "Progress", hint: "Work in progress — preparation, mid-install.", kind: "IMAGE" },
  { value: "AFTER", label: "After", hint: "The finished result. These are shown first on the website.", kind: "IMAGE" },
  { value: "VIDEO", label: "Video", hint: "Walkthroughs, time-lapses and clips.", kind: "VIDEO" },
];

export const PROJECT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/** Generic fallback for material type suggestions; industries can extend it via terminology.materialTypes (comma-separated). */
export const GENERIC_MATERIAL_TYPES = ["tile", "stone", "timber", "fixture", "fitting", "paint", "finish", "sealant", "adhesive", "grout", "pipe", "cable", "fabric", "glass", "metal", "other"];

