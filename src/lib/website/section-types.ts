import type { PageSection } from "@prisma/client";
import { asObject } from "@/lib/json";

/** Serialisable section shape shared by the section editor and the live editor. */
export interface SectionView {
  id: string;
  pageId: string;
  type: string;
  sortOrder: number;
  props: Record<string, unknown>;
  settings: Record<string, unknown>;
  isHidden: boolean;
  updatedAt: string;
}

export function toSectionView(s: PageSection): SectionView {
  return {
    id: s.id,
    pageId: s.pageId,
    type: s.type,
    sortOrder: s.sortOrder,
    props: asObject(s.props),
    settings: asObject(s.settings),
    isHidden: s.isHidden,
    updatedAt: s.updatedAt.toISOString(),
  };
}
