/**
 * Dotted-path helpers shared by the schema-driven form and the live editor.
 * Paths look like "items.0.title" or "primaryCta.label". Numeric segments
 * address array indexes. All helpers are immutable: setPath returns a copy.
 */
export type PathValue = unknown;

function segments(path: string): string[] {
  return path.split(".").filter((s) => s !== "");
}

export function getPath(obj: unknown, path: string): PathValue {
  let cur: unknown = obj;
  for (const seg of segments(path)) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) cur = cur[Number(seg)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[seg];
    else return undefined;
  }
  return cur;
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const segs = segments(path);
  if (segs.length === 0) return value as T;
  const clone = (node: unknown, index: number): unknown => {
    const seg = segs[index];
    const last = index === segs.length - 1;
    const nextIsIndex = !last && /^\d+$/.test(segs[index + 1]);
    if (Array.isArray(node) || (/^\d+$/.test(seg) && (node === undefined || node === null))) {
      const arr = Array.isArray(node) ? [...node] : [];
      const i = Number(seg);
      arr[i] = last ? value : clone(arr[i] ?? (nextIsIndex ? [] : {}), index + 1);
      return arr;
    }
    const base = node && typeof node === "object" ? { ...(node as Record<string, unknown>) } : {};
    base[seg] = last ? value : clone(base[seg] ?? (nextIsIndex ? [] : {}), index + 1);
    return base;
  };
  return clone(obj, 0) as T;
}

/** Removes a key / array index at the path (immutable). */
export function deletePath<T>(obj: T, path: string): T {
  const segs = segments(path);
  if (segs.length === 0) return obj;
  const parentPath = segs.slice(0, -1).join(".");
  const key = segs[segs.length - 1];
  const parent = parentPath ? getPath(obj, parentPath) : obj;
  if (Array.isArray(parent)) {
    const next = parent.filter((_, i) => i !== Number(key));
    return parentPath ? setPath(obj, parentPath, next) : (next as unknown as T);
  }
  if (parent && typeof parent === "object") {
    const next = { ...(parent as Record<string, unknown>) };
    delete next[key];
    return parentPath ? setPath(obj, parentPath, next) : (next as unknown as T);
  }
  return obj;
}
