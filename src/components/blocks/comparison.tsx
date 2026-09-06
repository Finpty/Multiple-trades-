import { Container, SectionHeading, SiteIcon } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Renders yes/no-ish values as check/cross icons; anything else as text. */
function Cell({ value, editField }: { value: string; editField: string }) {
  const v = value.trim().toLowerCase();
  if (["yes", "true", "✓", "✔", "included"].includes(v)) {
    return (
      <span className="inline-flex items-center gap-1.5" data-edit-field={editField}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--color-accent) 16%, transparent)", color: "var(--color-accent)" }}>
          <SiteIcon name="check" size={14} strokeWidth={3} />
        </span>
        <span className="sr-only">{value}</span>
      </span>
    );
  }
  if (["no", "false", "✗", "✕", "-", "—", "not included"].includes(v)) {
    return (
      <span className="inline-flex items-center opacity-40" data-edit-field={editField}>
        <SiteIcon name="minus" size={16} />
        <span className="sr-only">{value}</span>
      </span>
    );
  }
  return <span data-edit-field={editField}>{value}</span>;
}

/** Comparison table: first column = row label, remaining columns = options. */
function ComparisonBlock({ props, ctx, settings, editor }: TypedBlockProps<"comparison">) {
  const env = blockEnv(ctx, settings, "normal");
  const columns = props.columns ?? [];
  const rows = props.rows ?? [];
  if (rows.length === 0 && !editor) return null;
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} align="center" className="mb-10" />
      {rows.length === 0 ? (
        <p className="text-center text-sm opacity-60">Add columns and rows from the section panel.</p>
      ) : (
        <div className="overflow-x-auto" style={{ border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius)", background: "var(--color-background)", color: "var(--color-text)" }}>
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm sm:text-base">
            {columns.length > 0 && (
              <thead>
                <tr style={{ background: "var(--color-surface)" }}>
                  <th className="px-5 py-4 font-semibold" scope="col" />
                  {columns.map((c, i) => (
                    <th key={i} className="px-5 py-4 text-center" scope="col" style={{ fontFamily: "var(--font-heading)", color: i === 0 ? "var(--color-accent)" : undefined }} data-edit-field={`columns.${i}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} style={{ borderTop: "var(--border-width) solid var(--color-border)" }}>
                  <th scope="row" className="px-5 py-4 font-medium" data-edit-field={`rows.${r}.label`}>
                    {row.label}
                  </th>
                  {(columns.length ? columns : row.values).map((_, c) => (
                    <td key={c} className="px-5 py-4 text-center">
                      {row.values[c] !== undefined ? <Cell value={row.values[c]} editField={`rows.${r}.values.${c}`} /> : <span className="opacity-30">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}

defineBlock("comparison", ComparisonBlock);
