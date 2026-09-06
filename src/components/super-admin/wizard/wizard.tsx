"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, cn } from "@/components/ui";
import { Icon } from "@/components/admin/icon";
import { DEFAULT_THEME_TOKENS, mergeTokens, type ThemeTokens } from "@/lib/theme/tokens";
import { createBusinessFromWizardAction, loadTemplatePrefillAction, type CreateWizardResult } from "@/app/super-admin/create-business/actions";
import { WIZARD_STEPS, emptyState, pricingFromSeed, servicesFromSeed, servicesToTree, type WizardCatalog, type WizardState } from "./types";
import { LivePreview } from "./preview";
import { StepType } from "./step-type";
import { StepDetails } from "./step-details";
import { StepBrand } from "./step-brand";
import { StepStyle } from "./step-style";
import { StepServices } from "./step-services";
import { StepPricing } from "./step-pricing";
import { StepAreas } from "./step-areas";
import { StepFeatures } from "./step-features";
import { StepUsers } from "./step-users";
import { StepReview } from "./step-review";

const DRAFT_KEY = "tradeone.create-business.draft.v1";

export type Patch = (patch: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;

export interface StepProps {
  state: WizardState;
  patch: Patch;
  catalog: WizardCatalog;
  tokens: ThemeTokens;
  errors: Record<string, string>;
  onIndustryChange: (industryId: string) => void;
  onTemplateChange: (templateId: string | null) => Promise<void>;
  onGoTo: (step: number) => void;
  onSubmit: (publishNow: boolean) => Promise<void>;
  submitting: boolean;
}

function readDraft(): WizardState | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardState;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function draftHasContent(d: WizardState | null): d is WizardState {
  return !!d && (d.step > 0 || !!d.industryId || !!d.details.name);
}

/** Which steps map to which error-key prefixes (for jumping to the right step). */
const ERROR_STEP: Array<[RegExp, number]> = [
  [/^industryId/, 0],
  [/^templateId/, 0],
  [/^details\./, 1],
  [/^themeTokens/, 2],
  [/^designFamilySlug/, 3],
  [/^services/, 4],
  [/^pricingItems/, 5],
  [/^serviceAreas/, 6],
  [/^features/, 7],
  [/^owner/, 8],
];

export function CreateBusinessWizard({ catalog, initialTemplateId, initialIndustryId }: { catalog: WizardCatalog; initialTemplateId: string | null; initialIndustryId: string | null }) {
  const router = useRouter();
  const [state, setState] = React.useState<WizardState>(() => emptyState(catalog.defaults));
  const [hydrated, setHydrated] = React.useState(false);
  const [pendingDraft, setPendingDraft] = React.useState<WizardState | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<CreateWizardResult | null>(null);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);

  const patch = React.useCallback<Patch>((p) => {
    setState((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p), updatedAt: new Date().toISOString() }));
  }, []);

  const industry = React.useMemo(() => catalog.industries.find((i) => i.id === state.industryId) ?? null, [catalog.industries, state.industryId]);

  /** Fill services / pricing / features from the industry when the user has not chosen a template. */
  const applyIndustryDefaults = React.useCallback(
    (industryId: string) => {
      const ind = catalog.industries.find((i) => i.id === industryId);
      if (!ind) return;
      const features = ind.defaultFeatures.length ? ind.defaultFeatures : catalog.features.filter((f) => f.defaultEnabled).map((f) => f.key);
      patch((prev) => ({
        industryId,
        templateId: null,
        templateName: null,
        services: servicesFromSeed(ind.defaultServices),
        pricingItems: pricingFromSeed(ind.pricingFields),
        features: prev.featuresTouched ? prev.features : features.filter((k) => catalog.features.some((f) => f.key === k && !f.isPlatformOnly)),
      }));
    },
    [catalog.features, catalog.industries, patch],
  );

  const applyTemplate = React.useCallback(
    async (templateId: string | null) => {
      if (!templateId) {
        if (state.industryId) applyIndustryDefaults(state.industryId);
        return;
      }
      const tpl = catalog.templates.find((t) => t.id === templateId);
      setLoadingTemplate(true);
      setError(null);
      try {
        const res = await loadTemplatePrefillAction(templateId);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const pre = res.data;
        patch((prev) => ({
          templateId,
          templateName: tpl?.name ?? null,
          industryId: tpl?.industryId ?? prev.industryId,
          details: { ...prev.details, ...pre.details, name: prev.details.name, slug: prev.details.slug, slugTouched: prev.details.slugTouched, organizationMode: prev.details.organizationMode, organizationId: prev.details.organizationId, organizationName: prev.details.organizationName },
          designFamilySlug: pre.designFamilySlug ?? prev.designFamilySlug,
          brandOverrides: pre.brandOverrides,
          services: pre.services,
          pricingItems: pre.pricingItems,
          serviceAreas: pre.serviceAreas,
          features: pre.features.filter((k) => catalog.features.some((f) => f.key === k && !f.isPlatformOnly)),
          featuresTouched: true,
        }));
      } finally {
        setLoadingTemplate(false);
      }
    },
    [applyIndustryDefaults, catalog.features, catalog.templates, patch, state.industryId],
  );

  // Hydrate: draft from localStorage, else URL hints (?template=, ?industry=).
  React.useEffect(() => {
    const draft = readDraft();
    if (draftHasContent(draft) && !initialTemplateId && !initialIndustryId) {
      setPendingDraft(draft);
    } else {
      window.localStorage.removeItem(DRAFT_KEY);
      if (initialTemplateId) void applyTemplate(initialTemplateId);
      else if (initialIndustryId) applyIndustryDefaults(initialIndustryId);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the draft on every change.
  React.useEffect(() => {
    if (!hydrated || pendingDraft || result) return;
    try {
      if (state.industryId || state.details.name || state.step > 0) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable */
    }
  }, [state, hydrated, pendingDraft, result]);

  const family = React.useMemo(() => catalog.designFamilies.find((f) => f.slug === state.designFamilySlug) ?? catalog.designFamilies[0] ?? null, [catalog.designFamilies, state.designFamilySlug]);
  const tokens = React.useMemo<ThemeTokens>(() => {
    const base = family?.tokens ?? DEFAULT_THEME_TOKENS;
    try {
      return mergeTokens(base, state.brandOverrides);
    } catch {
      return base;
    }
  }, [family, state.brandOverrides]);

  /* ── step validation (client) ───────────────────────────────────────── */
  const validateStep = (step: number): Record<string, string> => {
    const e: Record<string, string> = {};
    const d = state.details;
    if (step === 0 && !state.industryId) e.industryId = "Choose a business type to continue.";
    if (step === 1) {
      if (d.name.trim().length < 2) e["details.name"] = "Business name is required.";
      if (d.slug.trim().length < 2) e["details.slug"] = "A slug is required.";
      if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e["details.email"] = "Enter a valid email address.";
      if (d.organizationMode === "existing" && !d.organizationId) e["details.organizationId"] = "Choose an organisation.";
      if (d.taxRate !== "" && (Number.isNaN(Number(d.taxRate)) || Number(d.taxRate) < 0 || Number(d.taxRate) > 100)) e["details.taxRate"] = "Tax rate must be between 0 and 100.";
      if (d.foundedYear && (Number.isNaN(Number(d.foundedYear)) || Number(d.foundedYear) < 1800 || Number(d.foundedYear) > 2100)) e["details.foundedYear"] = "Enter a valid year.";
    }
    if (step === 4) {
      if (state.services.length === 0) e.services = "Add at least one service.";
      state.services.forEach((s, i) => {
        if (!s.name.trim()) e[`services.${i}.name`] = "Service name is required.";
      });
    }
    if (step === 5) {
      const keys = new Set<string>();
      state.pricingItems.forEach((p, i) => {
        if (!p.key.trim()) e[`pricingItems.${i}.key`] = "Key is required.";
        else if (keys.has(p.key.trim())) e[`pricingItems.${i}.key`] = "Duplicate key.";
        keys.add(p.key.trim());
        if (!p.label.trim()) e[`pricingItems.${i}.label`] = "Label is required.";
        if (p.amount.trim() === "" || Number.isNaN(Number(p.amount))) e[`pricingItems.${i}.amount`] = "Enter an amount.";
      });
    }
    if (step === 8 && state.owner.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.owner.email)) e["owner.email"] = "Enter a valid email address.";
    return e;
  };

  const goTo = (step: number) => {
    setErrors({});
    patch({ step: Math.max(0, Math.min(WIZARD_STEPS.length - 1, step)) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => {
    const e = validateStep(state.step);
    setErrors(e);
    if (Object.keys(e).length) return;
    goTo(state.step + 1);
  };

  const buildPayload = () => {
    const d = state.details;
    return {
      industryId: state.industryId,
      templateId: state.templateId,
      details: { ...d, taxRate: d.taxRate === "" ? 10 : Number(d.taxRate), foundedYear: d.foundedYear },
      designFamilySlug: family?.slug ?? null,
      themeTokens: tokens,
      services: servicesToTree(state.services),
      pricingItems: state.pricingItems.map((p) => ({ key: p.key, label: p.label, type: p.type, amount: Number(p.amount), unit: p.unit, category: p.category })),
      serviceAreas: state.serviceAreas.map((a) => ({ name: a.name, type: a.type, postcode: a.postcode, state: a.state, isPrimary: a.isPrimary })),
      features: state.features,
      owner: state.owner.email ? state.owner : undefined,
      publishNow: state.publishNow,
    };
  };

  const submit = async (publishNow: boolean) => {
    // Validate every step before sending.
    const all: Record<string, string> = {};
    for (let i = 0; i < WIZARD_STEPS.length - 1; i++) Object.assign(all, validateStep(i));
    if (Object.keys(all).length) {
      setErrors(all);
      const firstKey = Object.keys(all)[0];
      const step = ERROR_STEP.find(([re]) => re.test(firstKey))?.[1] ?? state.step;
      setError("Some steps need attention before the business can be created.");
      patch({ step });
      return;
    }
    setSubmitting(true);
    setError(null);
    setErrors({});
    try {
      const res = await createBusinessFromWizardAction({ ...buildPayload(), publishNow });
      if (!res.ok) {
        setError(res.error);
        const fe = res.fieldErrors ?? {};
        setErrors(fe);
        const firstKey = Object.keys(fe)[0];
        if (firstKey) {
          const step = ERROR_STEP.find(([re]) => re.test(firstKey))?.[1];
          if (step !== undefined) patch({ step });
        }
        return;
      }
      setResult(res.data);
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      router.push(`/admin/${res.data.businessId}/setup${res.data.warnings.length ? "?created=1&warnings=" + encodeURIComponent(res.data.warnings.join("\n")) : "?created=1"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const discardDraft = () => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setPendingDraft(null);
    setState(emptyState(catalog.defaults));
  };
  const resumeDraft = () => {
    if (pendingDraft) setState({ ...pendingDraft, updatedAt: new Date().toISOString() });
    setPendingDraft(null);
  };

  if (!hydrated) return <div className="text-sm text-neutral-500">Loading wizard…</div>;

  if (pendingDraft) {
    return (
      <Card className="mx-auto max-w-xl p-6">
        <h2 className="text-lg font-semibold">Resume your draft?</h2>
        <p className="mt-1 text-sm text-neutral-600">
          You have an unfinished business{pendingDraft.details.name ? <> called <strong>{pendingDraft.details.name}</strong></> : null} saved in this browser (step {pendingDraft.step + 1} of {WIZARD_STEPS.length}, last edited {new Date(pendingDraft.updatedAt).toLocaleString()}).
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={resumeDraft}>Resume draft</Button>
          <Button variant="secondary" onClick={discardDraft}>Discard and start fresh</Button>
        </div>
      </Card>
    );
  }

  if (result) {
    return (
      <Card className="mx-auto max-w-xl p-6">
        <h2 className="text-lg font-semibold">Business created</h2>
        <p className="mt-1 text-sm text-neutral-600">Taking you to the setup checklist…</p>
      </Card>
    );
  }

  const stepProps: StepProps = { state, patch, catalog, tokens, errors, onIndustryChange: applyIndustryDefaults, onTemplateChange: applyTemplate, onGoTo: goTo, onSubmit: submit, submitting };
  const StepComponent = [StepType, StepDetails, StepBrand, StepStyle, StepServices, StepPricing, StepAreas, StepFeatures, StepUsers, StepReview][state.step] ?? StepType;
  const isLast = state.step === WIZARD_STEPS.length - 1;

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
      {/* Step rail */}
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <ol className="flex gap-1 overflow-x-auto xl:flex-col xl:gap-0.5">
          {WIZARD_STEPS.map((s, i) => {
            const done = i < state.step;
            const active = i === state.step;
            return (
              <li key={s.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => (i <= state.step ? goTo(i) : undefined)}
                  disabled={i > state.step}
                  className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm", active ? "bg-neutral-900 text-white" : done ? "text-neutral-800 hover:bg-neutral-100" : "text-neutral-400")}
                >
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", active ? "bg-white text-neutral-900" : done ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500")}>{done ? <Icon name="Check" className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.label}</span>
                    <span className={cn("hidden text-[11px] xl:block", active ? "text-neutral-300" : "text-neutral-400")}>{s.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {state.templateName && (
          <div className="mt-3 hidden rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900 xl:block">
            Using template <strong>{state.templateName}</strong>
          </div>
        )}
      </aside>

      {/* Content */}
      <div className="min-w-0">
        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}
        {loadingTemplate && (
          <Alert tone="info" className="mb-4">
            Loading template…
          </Alert>
        )}
        <Card className="p-5 sm:p-6">
          <div className="mb-5">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Step {state.step + 1} of {WIZARD_STEPS.length}
            </div>
            <h2 className="text-xl font-semibold text-neutral-900">{WIZARD_STEPS[state.step].label}</h2>
          </div>
          <StepComponent {...stepProps} />
        </Card>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => goTo(state.step - 1)} disabled={state.step === 0 || submitting}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-neutral-400 sm:inline">Draft saved automatically in this browser</span>
            {!isLast && (
              <Button onClick={next} disabled={loadingTemplate}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <aside className="hidden xl:block xl:sticky xl:top-6 xl:self-start">
        <LivePreview tokens={tokens} state={state} industryName={industry?.name ?? null} />
      </aside>
    </div>
  );
}
