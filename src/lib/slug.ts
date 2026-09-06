export function slugify(input: string, { maxLength = 80 }: { maxLength?: number } = {}): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Reserved first path segments on platform hosts; never valid business slugs. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "super-admin",
  "api",
  "login",
  "logout",
  "register",
  "auth",
  "media",
  "storage",
  "_next",
  "s",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "www",
  "app",
  "platform",
  "static",
  "assets",
  "public",
  "health",
  "portal",
  "preview",
  "s",
  "q",
  "i",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export async function uniqueSlug(base: string, exists: (candidate: string) => Promise<boolean>): Promise<string> {
  let candidate = slugify(base) || "item";
  if (isReservedSlug(candidate)) candidate = `${candidate}-1`;
  let i = 2;
  while (await exists(candidate)) {
    candidate = `${slugify(base) || "item"}-${i++}`;
  }
  return candidate;
}
