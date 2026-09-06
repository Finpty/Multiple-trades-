import { loadTeamForBlock } from "@/lib/site/blocks/team";
import { initials } from "@/lib/site/blocks/common";
import { Container, SectionHeading, SmartImage } from "@/components/site/primitives";
import { blockEnv, defineBlock, type TypedBlockProps } from "./define";

/** Team member cards (photo or initials avatar, name, role, bio). */
async function TeamBlock({ props, ctx, settings, editor }: TypedBlockProps<"team">) {
  const env = blockEnv(ctx, settings, "normal");
  const members = await loadTeamForBlock(ctx, { source: props.source ?? "all", memberIds: props.memberIds });
  if (members.length === 0 && !editor) return null;
  const cols = members.length <= 2 ? "sm:grid-cols-2" : members.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <Container width={env.width}>
      <SectionHeading heading={props.heading} intro={props.intro} align="center" className="mb-12" />
      {members.length === 0 ? (
        <p className="text-center text-sm opacity-60">No active team members yet — add them under Team in the admin.</p>
      ) : (
        <ul className={`grid grid-cols-1 gap-8 ${cols}`}>
          {members.map((m) => (
            <li key={m.id} className="flex flex-col items-center text-center">
              <SmartImage
                image={m.photo}
                aspect="1/1"
                imageStyle={env.tokens.imageStyle}
                sizes="(min-width: 1024px) 280px, 50vw"
                className="w-40 sm:w-48"
                style={{ borderRadius: "999px" }}
                fallback={
                  <span className="flex h-40 w-40 items-center justify-center rounded-full text-3xl font-semibold sm:h-48 sm:w-48" style={{ background: "var(--color-surface)", color: "var(--color-primary)", fontFamily: "var(--font-heading)", border: "var(--border-width) solid var(--color-border)" }} aria-hidden="true">
                    {initials(m.name)}
                  </span>
                }
              />
              <h3 className="mt-5 text-lg" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" as React.CSSProperties["fontWeight"] }}>
                {m.name}
              </h3>
              {m.role && <p className="mt-1 text-sm font-medium uppercase tracking-[0.12em]" style={{ color: env.onDark ? "inherit" : "var(--color-accent)" }}>{m.role}</p>}
              {m.bio && <p className="mt-3 max-w-xs text-sm leading-relaxed opacity-80">{m.bio}</p>}
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

defineBlock("team", TeamBlock);
