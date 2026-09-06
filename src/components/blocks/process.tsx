import { loadWorkflowSteps, type SiteProcessStep } from "@/lib/site/blocks/workflow";
import { Container, IconBadge, SectionHeading } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

const HCOLS: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5" };

/**
 * Process steps. source = "workflow" reads the stages of the default Workflow
 * (so the site always matches how the business actually runs jobs); manual
 * steps are edited in place.
 */
async function ProcessBlock({ props, ctx, settings, editor }: TypedBlockProps<"process">) {
  const env = blockEnv(ctx, settings, "normal");
  const fromWorkflow = props.source === "workflow";
  let steps: SiteProcessStep[] = (props.steps ?? []).map((s) => ({ title: s.title, description: s.description ?? null, icon: s.icon ?? null, color: null }));
  if (fromWorkflow) {
    const wf = await loadWorkflowSteps(ctx);
    if (wf.length > 0) steps = wf;
  }
  if (steps.length === 0 && !editor) return null;
  const horizontal = steps.length > 0 && steps.length <= 5;
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} align="center" className="mb-12" />
      {steps.length === 0 ? (
        <p className="text-center text-sm opacity-60">{fromWorkflow ? "No workflow stages yet — add steps manually or configure a workflow." : "Add steps from the section panel."}</p>
      ) : (
        <ol className={["relative grid gap-8", horizontal ? HCOLS[steps.length] : "sm:grid-cols-2 lg:grid-cols-3"].join(" ")}>
          {horizontal && <div className="site-process-line hidden md:block" aria-hidden="true" />}
          {steps.map((step, i) => (
            <li key={i} className="relative flex flex-col items-start gap-4">
              <div className="relative flex items-center gap-3" style={{ background: env.onDark ? "transparent" : "inherit" }}>
                <IconBadge name={step.icon} fallback={<span className="text-base">{i + 1}</span>} tone={env.onDark ? "surface" : "primary"} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">Step {i + 1}</span>
              </div>
              <div>
                <h3 className="text-lg leading-snug" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }} data-edit-field={fromWorkflow ? undefined : `steps.${i}.title`}>
                  {step.title}
                </h3>
                {(step.description || (editor && !fromWorkflow)) && (
                  <p className="mt-2 text-sm leading-relaxed opacity-80 sm:text-base" data-edit-field={fromWorkflow ? undefined : `steps.${i}.description`}>
                    {step.description || "Add a description"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Container>
  );
}

defineBlock("process", ProcessBlock);
