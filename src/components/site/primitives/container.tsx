import type { SectionWidth } from "@/lib/site/blocks/common";

const WIDTHS: Record<SectionWidth, string> = {
  narrow: "max-w-3xl",
  normal: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

/** Horizontal container. Width variants match SectionSettings.width. */
export function Container({ width = "normal", className = "", children, flush = false, ...rest }: { width?: SectionWidth; className?: string; children: React.ReactNode; flush?: boolean } & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  const padding = width === "full" && flush ? "" : "px-5 sm:px-6 lg:px-8";
  return (
    <div className={["mx-auto w-full", WIDTHS[width], padding, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}
