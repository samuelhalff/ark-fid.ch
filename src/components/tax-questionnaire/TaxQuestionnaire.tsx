"use client";

import { ArrowLeft, ArrowRight, CircleNotch, EnvelopeSimple, Phone, SignOut, Sparkle } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible";
import { Form } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Progress } from "@/src/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Separator } from "@/src/components/ui/separator";
import { Textarea } from "@/src/components/ui/textarea";
import { trackEvent } from "@/src/lib/analytics";
import { docCode } from "@/src/lib/tax-questionnaire/documents";
import { checklistFor, displayValue, isBlockVisible, isRowFieldVisible, label as interpolate, pruneHidden, visibleSteps } from "@/src/lib/tax-questionnaire/logic";
import { GROUP_STEP, ROUTER_OPTIONS, routerItems, rowsOf, unchanged } from "@/src/lib/tax-questionnaire/schema";
import { CONTACT, SERVER_ERRORS, UI, UI2 } from "@/src/lib/tax-questionnaire/ui";
import type { Answers, QfLocale, StepDef } from "@/src/lib/tax-questionnaire/types";
import { ApiError, api, newSubmitKey, type CasePayload } from "./api";
import { DocChecklist } from "./DocChecklist";
import { fromForm, stepSchema, toForm, toName, type FormValues } from "./form-model";
import { StepView } from "./StepView";
import { Turnstile } from "./Turnstile";

type Phase = "loading" | "start" | "code" | "form" | "status" | "optedOut";

const err = (code: string, locale: QfLocale) => (SERVER_ERRORS[code] || SERVER_ERRORS.generic)[locale];
const defaultAnswers = (): Answers => ({ "start.years": [String(new Date().getFullYear() - 1)] });

/** Steps actually shown: visible ones, minus detail screens confirmed "unchanged since last year". */
function shownSteps(answers: Answers): StepDef[] {
  return visibleSteps(answers).filter((step) => {
    const group = Object.entries(GROUP_STEP).find(([, stepId]) => stepId === step.id)?.[0];
    // An area confirmed unchanged keeps last year's rows (same documents requested) and skips its screen.
    return !group || !unchanged(group)(answers);
  });
}

/** Names carried over from last year, per router group (shown next to "unchanged"). */
function knownItems(answers: Answers): Record<string, string[]> {
  if (!answers["base.prefilledFrom"]) return {};
  const names = (groupId: string, field: string) => rowsOf(answers, groupId).map((r) => (typeof r[field] === "string" ? (r[field] as string) : "")).filter(Boolean);
  const items = routerItems(answers);
  const label = (value: string) => ROUTER_OPTIONS.find((o) => o.value === value)?.label.fr || value;
  return {
    family: [...names("family.children", "firstName"), ...items.filter((i) => ROUTER_OPTIONS.find((o) => o.value === i)?.group === "family").map(label)],
    work: [...names("work.employers", "name"), ...names("work.pensions", "payer"), ...names("work.companies", "name")],
    assets: [...names("assets.banks", "bank"), ...names("assets.insurances", "insurer"), ...names("assets.debts", "lender")],
    property: [...names("property.items", "commune"), ...names("property.items", "city")],
    other: items.filter((i) => ROUTER_OPTIONS.find((o) => o.value === i)?.group === "other").map(label),
  };
}

export default function TaxQuestionnaire({ locale, mode }: { locale: QfLocale; mode: "main" | "tax" }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [config, setConfig] = useState<{ turnstileSiteKey: string; aiEnabled: boolean }>({ turnstileSiteKey: "", aiEnabled: false });
  const [caseData, setCaseData] = useState<CasePayload | null>(null);
  const [stepId, setStepId] = useState("start");
  const [docStatus, setDocStatus] = useState<Record<string, "later" | "na">>({});
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "failed"; at?: string }>({ state: "idle" });
  // Access flow
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [challenge, setChallenge] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [code, setCode] = useState("");
  const [find, setFind] = useState<{ open: boolean; email: string; done: boolean }>({ open: false, email: "", done: false });
  // Review
  const [certified, setCertified] = useState(false);
  const [aiOptIn, setAiOptIn] = useState(false);
  const submitKey = useRef(newSubmitKey());
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});

  const stepRef = useRef<StepDef | null>(null);
  const resolver: Resolver<FormValues> = useCallback(
    async (values, context, options) => {
      const step = stepRef.current;
      if (!step) return { values, errors: {} };
      return zodResolver(stepSchema(step, locale))(values, context, options);
    },
    [locale],
  );
  const form = useForm<FormValues>({ resolver, defaultValues: toForm(defaultAnswers()), mode: "onSubmit", reValidateMode: "onChange" });
  const values = form.watch();
  const answers = useMemo(() => fromForm(values), [values]);
  const steps = useMemo(() => shownSteps(answers), [answers]);
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[index] || steps[0];
  stepRef.current = step;
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const pruned = useMemo(() => pruneHidden(answers), [answers]);
  const checklist = useMemo(() => checklistFor(answers), [answers]);
  const files = useMemo(() => caseData?.files || [], [caseData]);

  // ---- loading: magic link in the fragment, else an existing session ----------------------------
  const loadCase = useCallback(async () => {
    const data = await api.getCase();
    setCaseData(data);
    if (data.draft) {
      form.reset(toForm({ ...defaultAnswers(), ...(data.draft.answers as Answers) }));
      setDocStatus(data.draft.docStatus || {});
      setAiOptIn(data.draft.aiOptIn === true);
      if (data.draft.stepId && data.draft.stepId !== "start") setStepId(data.draft.stepId);
    }
    setPhase(data.state === "submitted" ? "status" : "form");
    return data;
  }, [form]);

  useEffect(() => {
    void api.config().then(setConfig, () => undefined);
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const token = /acces=([A-Za-z0-9_-]+)/.exec(hash)?.[1];
    if (token) {
      window.history.replaceState(null, "", window.location.pathname);
      api
        .auth({ action: "link", token, locale })
        .then((res) => {
          if (res.optedOut) return setPhase("optedOut");
          setChallenge(res.challenge || "");
          setEmailHint(res.emailHint || "");
          setPhase("code");
        })
        .catch(() => {
          setNotice({ tone: "error", text: UI2.linkInvalid[locale] });
          setFind((f) => ({ ...f, open: true }));
          setPhase("start");
        });
      return;
    }
    loadCase().catch(() => setPhase("start"));
  }, [loadCase, locale]);

  // ---- analytics: step views, abandonment -----------------------------------------------------------
  useEffect(() => {
    if (phase === "form" || phase === "start") trackEvent("tax_qf_step_view", { step: step.id, index: index + 1, total: steps.length });
  }, [phase, step.id, index, steps.length]);
  useEffect(() => {
    const onHide = () => {
      if (phase === "form" || phase === "start") trackEvent("tax_qf_abandon", { step: step.id });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [phase, step.id]);

  // ---- autosave (server-side draft; nothing persistent in the browser) -----------------------------
  const saveNow = useCallback(async () => {
    if (phase !== "form" || caseData?.scope !== "edit") return;
    setSave({ state: "saving" });
    try {
      const res = await api.caseAction<{ savedAt: string }>("save", { answers: fromForm(form.getValues()), stepId: stepRef.current?.id, docStatus, locale, aiOptIn });
      setSave({ state: "saved", at: res.savedAt });
    } catch (error) {
      setSave({ state: "failed" });
      if (error instanceof ApiError && error.status === 401) setPhase("start");
    }
  }, [phase, caseData?.scope, docStatus, locale, aiOptIn, form]);
  useEffect(() => {
    if (phase !== "form") return;
    const timer = setTimeout(() => void saveNow(), 1500);
    return () => clearTimeout(timer);
  }, [values, docStatus, phase, saveNow]);

  // Last return uploaded → "unchanged" shortcuts may use the extracted / carried-over items.
  useEffect(() => {
    const lastReturn = files.some((f) => f.code === docCode("last-return"));
    if (lastReturn && answers["base.lastReturnUploaded"] !== "yes") form.setValue(toName("base.lastReturnUploaded"), "yes");
  }, [files, answers, form]);

  const refreshFiles = useCallback(async () => {
    try {
      const data = await api.getCase();
      setCaseData(data);
    } catch {
      /* keep the current list */
    }
  }, []);

  const goTo = (id: string) => {
    setStepId(id);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- navigation ------------------------------------------------------------------------------------
  const next = async () => {
    setNotice(null);
    const valid = await form.trigger();
    if (!valid) {
      setNotice({ tone: "error", text: UI.errorSummary[locale] });
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    trackEvent("tax_qf_step_complete", { step: step.id });
    if (step.id === "router") {
      const flags = Object.fromEntries(routerItems(answers).slice(0, 24).map((item) => [`r_${item}`, true]));
      trackEvent("tax_qf_router", flags);
    }
    if (phase === "start") return startAccess();
    const following = steps[index + 1];
    if (following) {
      void saveNow();
      goTo(following.id);
    }
  };
  const back = () => {
    const previous = steps[index - 1];
    if (previous) goTo(previous.id);
  };

  // ---- access ----------------------------------------------------------------------------------------
  const startAccess = async () => {
    if (!privacyAccepted) return setNotice({ tone: "error", text: SERVER_ERRORS.consent_required[locale] });
    if (config.turnstileSiteKey && !turnstileToken) return setNotice({ tone: "error", text: UI.humanCheck[locale] });
    setBusy(true);
    try {
      const res = await api.auth({ action: "start", locale, answers: fromForm(form.getValues()), privacyAccepted: true, turnstileToken });
      setChallenge(res.challenge || "");
      setEmailHint(res.emailHint || "");
      setCode("");
      setPhase("code");
    } catch (error) {
      setNotice({ tone: "error", text: err(error instanceof ApiError ? error.code : "generic", locale) });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await api.auth({ action: "verify", challenge, code, locale, answers: fromForm(form.getValues()) });
      const data = await loadCase();
      if (data.state !== "submitted" && (!data.draft || data.draft.stepId === "start")) {
        const firstAfterStart = shownSteps(fromForm(form.getValues()))[1];
        if (firstAfterStart) setStepId(firstAfterStart.id);
      }
    } catch (error) {
      setNotice({ tone: "error", text: err(error instanceof ApiError ? error.code : "generic", locale) });
    } finally {
      setBusy(false);
    }
  };

  const sendFind = async () => {
    setBusy(true);
    try {
      await api.auth({ action: "find", email: find.email, locale, turnstileToken });
      setFind((f) => ({ ...f, done: true }));
    } catch (error) {
      setNotice({ tone: "error", text: err(error instanceof ApiError ? error.code : "generic", locale) });
    } finally {
      setBusy(false);
    }
  };

  // ---- submission ------------------------------------------------------------------------------------
  const submit = async () => {
    setNotice(null);
    const valid = await form.trigger();
    if (!valid) return setNotice({ tone: "error", text: UI.errorSummary[locale] });
    if (!certified) return setNotice({ tone: "error", text: SERVER_ERRORS.consent_required[locale] });
    if (uploading) return setNotice({ tone: "error", text: UI.uploadsBusy[locale] });
    setBusy(true);
    try {
      await saveNow();
      await api.caseAction("submit", { answers: fromForm(form.getValues()), docStatus, locale, privacyAccepted: true, certified: true, aiOptIn, submitKey: submitKey.current });
      trackEvent("tax_qf_submit", { result: "ok", docs: checklist.length });
      setJustSubmitted(true);
      await loadCase();
      window.scrollTo({ top: 0 });
    } catch (error) {
      const codeName = error instanceof ApiError ? error.code : "generic";
      trackEvent("tax_qf_submit", { result: codeName });
      if (codeName === "invalid_answers" && error instanceof ApiError && Array.isArray(error.detail.steps) && error.detail.steps[0]) goTo(String(error.detail.steps[0]));
      setNotice({ tone: "error", text: err(codeName, locale) });
    } finally {
      setBusy(false);
    }
  };

  // ---- rendering -------------------------------------------------------------------------------------
  const languageLinks = (["fr", "en", "de"] as const).map((l) => ({ l, href: mode === "tax" ? `/${l}/` : `/${l}/questionnaire-fiscal/` }));
  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary">{UI2.eyebrow[locale]}</Badge>
        <nav aria-label="Langue" className="flex gap-1 text-sm">
          {languageLinks.map(({ l, href }) => (
            <a key={l} href={href} hrefLang={l} aria-current={l === locale ? "true" : undefined} className={l === locale ? "rounded-md bg-surface-warm px-2 py-1 font-semibold dark:bg-card" : "rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"}>
              {l.toUpperCase()}
            </a>
          ))}
        </nav>
      </div>
      <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{UI.pageTitle[locale]}</h1>
      <p className="max-w-[60ch] text-base leading-7 text-muted-foreground">{UI.pageIntro[locale]}</p>
    </div>
  );

  const noticeBox = notice ? (
    <Alert variant={notice.tone === "error" ? "destructive" : "default"} aria-live="assertive">
      <AlertDescription>{notice.text}</AlertDescription>
    </Alert>
  ) : null;

  const contact = (
    <Card className="gap-2 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{UI.helpTitle[locale]}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-5 text-sm">
        <span className="font-medium">{CONTACT.name}</span>
        <a className="inline-flex items-center gap-2 hover:underline" href={CONTACT.phoneHref}>
          <Phone className="size-4" /> {CONTACT.phone}
        </a>
        <a className="inline-flex items-center gap-2 hover:underline" href={`mailto:${CONTACT.email}`}>
          <EnvelopeSimple className="size-4" /> {CONTACT.email}
        </a>
      </CardContent>
    </Card>
  );

  const privacy = (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="link" className="h-auto px-0 text-sm">
          {UI2.privacyShort[locale]}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md bg-surface-warm p-4 text-sm leading-6 text-muted-foreground dark:bg-card">
        <p>{UI.privacyText[locale]}</p>
        <a className="mt-2 inline-block underline" href={`https://ark-fid.ch/${locale}/legal/privacy/`}>
          {UI.privacyLink[locale]}
        </a>
      </CollapsibleContent>
    </Collapsible>
  );

  if (phase === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <CircleNotch className="size-6 animate-spin" aria-label={UI2.linkOpening[locale]} />
      </div>
    );
  }

  if (phase === "optedOut") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Alert>
          <AlertDescription>{UI2.optedOut[locale]}</AlertDescription>
        </Alert>
        {contact}
      </div>
    );
  }

  if (phase === "code") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{UI2.codeTitle[locale]}</CardTitle>
            <CardDescription>{UI2.codeText[locale].replace("{email}", emailHint)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Label htmlFor="tqf-code">{UI2.codeLabel[locale]}</Label>
            <Input id="tqf-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="max-w-40 text-lg tracking-[0.3em]" />
            {noticeBox}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button type="button" onClick={verify} disabled={busy || code.length !== 6}>
              {busy ? <CircleNotch className="size-4 animate-spin" /> : null}
              {UI2.verify[locale]}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPhase("start")}>
              {UI2.resendCode[locale]}
            </Button>
          </CardFooter>
        </Card>
        {contact}
      </div>
    );
  }

  if (phase === "status" && caseData) {
    return <StatusView caseData={caseData} answers={pruned} checklist={checklist} docStatus={docStatus} locale={locale} justSubmitted={justSubmitted} onChanged={refreshFiles} onReopen={async () => {
      await api.caseAction("reopen");
      await loadCase();
      setPhase("form");
      goTo("review");
    }} header={header} contact={contact} />;
  }

  // phase "start" (no session yet) or "form"
  const progress = Math.round(((index + 1) / Math.max(steps.length, 1)) * 100);
  const special = step.special;
  const items = special === "baseDocs" ? checklist.filter((i) => i.base) : checklist;

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void (special === "review" ? submit() : next());
        }}
      >
        {header}
        <div className="sticky top-16 z-20 -mx-5 flex flex-col gap-2 bg-background/95 px-5 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{UI.stepOf[locale].replace("{n}", String(index + 1)).replace("{total}", String(steps.length))}</span>
            <span className="text-muted-foreground" aria-live="polite">
              {save.state === "saving" ? UI2.saving[locale] : save.state === "saved" && save.at ? UI2.savedAt[locale].replace("{time}", new Date(save.at).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })) : save.state === "failed" ? UI2.saveFailed[locale] : ""}
            </span>
          </div>
          <Progress value={progress} aria-label={UI.stepOf[locale].replace("{n}", String(index + 1)).replace("{total}", String(steps.length))} />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">{L(step.title)}</CardTitle>
              {step.intro ? <CardDescription className="text-base">{L(step.intro)}</CardDescription> : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {special === "documents" ? (
                <>
                  <p className="text-sm text-muted-foreground">{UI.docsIntro[locale]}</p>
                  <DocChecklist items={items} files={files} docStatus={docStatus} onStatus={(key, status) => setDocStatus((prev) => { const nextStatus = { ...prev }; if (status) nextStatus[key] = status; else delete nextStatus[key]; return nextStatus; })} locale={locale} clientName={`${String(answers["start.firstName"] || "")} ${String(answers["start.lastName"] || "")}`.trim()} canRemove onChanged={refreshFiles} onBusy={setUploading} />
                </>
              ) : special === "review" ? (
                <ReviewSummary answers={pruned} locale={locale} onEdit={goTo} />
              ) : null}
              {special !== "documents" ? <StepView step={step} locale={locale} answers={answers} knownItems={knownItems(answers)} aiSuggestions={aiSuggestions} /> : null}
              {special === "baseDocs" && caseData ? (
                <DocChecklist items={items} files={files} docStatus={docStatus} onStatus={(key, status) => setDocStatus((prev) => { const nextStatus = { ...prev }; if (status) nextStatus[key] = status; else delete nextStatus[key]; return nextStatus; })} locale={locale} clientName={`${String(answers["start.firstName"] || "")} ${String(answers["start.lastName"] || "")}`.trim()} canRemove onChanged={refreshFiles} onBusy={setUploading} showExtra={false} />
              ) : null}
              {step.id === "router" && config.aiEnabled && aiOptIn ? <AiSuggest locale={locale} onSuggest={(list) => setAiSuggestions(list)} /> : null}
              {config.aiEnabled && aiOptIn && step.id !== "regularisation" && !special ? <AiHelp locale={locale} stepId={step.id} /> : null}

              {phase === "start" ? (
                <div className="flex flex-col gap-4">
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Checkbox id="tqf-privacy" checked={privacyAccepted} onCheckedChange={(v) => setPrivacyAccepted(v === true)} />
                    <Label htmlFor="tqf-privacy" className="font-normal leading-snug">
                      {UI.privacyAck[locale]}
                    </Label>
                  </div>
                  {privacy}
                  <Turnstile siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />
                </div>
              ) : null}

              {special === "review" ? (
                <div className="flex flex-col gap-4">
                  <Separator />
                  {config.aiEnabled ? (
                    <div className="flex items-start gap-3">
                      <Checkbox id="tqf-ai" checked={aiOptIn} onCheckedChange={(v) => setAiOptIn(v === true)} />
                      <Label htmlFor="tqf-ai" className="font-normal leading-snug">
                        {UI2.aiOptIn[locale]}
                      </Label>
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3">
                    <Checkbox id="tqf-certify" checked={certified} onCheckedChange={(v) => setCertified(v === true)} />
                    <Label htmlFor="tqf-certify" className="font-normal leading-snug">
                      {UI.certify[locale]}
                    </Label>
                  </div>
                  {privacy}
                </div>
              ) : null}
              {noticeBox}
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={back} disabled={index === 0 || busy}>
                <ArrowLeft className="size-4" />
                {UI.back[locale]}
              </Button>
              <div className="flex flex-wrap gap-2">
                {special === "baseDocs" ? (
                  <Button type="button" variant="ghost" onClick={() => steps[index + 1] && goTo(steps[index + 1].id)}>
                    {UI2.skip[locale]}
                  </Button>
                ) : null}
                <Button type="submit" disabled={busy || (special === "review" && uploading)}>
                  {busy ? <CircleNotch className="size-4 animate-spin" /> : null}
                  {special === "review" ? UI.submit[locale] : phase === "start" ? UI2.sendCode[locale] : UI.next[locale]}
                  {special !== "review" ? <ArrowRight className="size-4" /> : null}
                </Button>
              </div>
            </CardFooter>
          </Card>

          <aside className="flex flex-col gap-4">
            {phase === "form" ? (
              <Card className="gap-3 py-5">
                <CardContent className="flex flex-col gap-3 px-5 text-sm text-muted-foreground">
                  <p>{UI2.draftStored[locale]}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={async () => {
                      await saveNow();
                      await api.caseAction("resumeLink").then(() => setNotice({ tone: "info", text: UI2.continueLaterDone[locale] }), () => undefined);
                    }}>
                      {UI2.continueLater[locale]}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={async () => {
                      if (!window.confirm(UI.draftDeleteConfirm[locale])) return;
                      await api.caseAction("delete").catch(() => undefined);
                      await api.auth({ action: "logout" }).catch(() => undefined);
                      form.reset(toForm(defaultAnswers()));
                      setCaseData(null);
                      setStepId("start");
                      setPhase("start");
                      setNotice({ tone: "info", text: UI2.draftDeleted[locale] });
                    }}>
                      {UI.draftDelete[locale]}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={async () => {
                      await saveNow();
                      await api.auth({ action: "logout" }).catch(() => undefined);
                      window.location.reload();
                    }}>
                      <SignOut className="size-4" />
                      {UI2.logout[locale]}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="gap-3 py-5">
                <CardContent className="flex flex-col gap-3 px-5 text-sm">
                  <span className="font-medium">{UI2.alreadyStarted[locale]}</span>
                  {find.open ? (
                    find.done ? (
                      <p className="text-muted-foreground">{UI2.findDone[locale]}</p>
                    ) : (
                      <>
                        <p className="text-muted-foreground">{UI2.findText[locale]}</p>
                        <Input type="email" autoComplete="email" value={find.email} onChange={(e) => setFind((f) => ({ ...f, email: e.target.value }))} aria-label="E-mail" />
                        <Button type="button" size="sm" onClick={sendFind} disabled={busy || !find.email}>
                          {UI2.findSend[locale]}
                        </Button>
                      </>
                    )
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => setFind((f) => ({ ...f, open: true }))}>
                      {UI2.findTitle[locale]}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
            {contact}
          </aside>
        </div>
      </form>
    </Form>
  );
}

/** Read-only summary of the answers with links back to each screen. */
function ReviewSummary({ answers, locale, onEdit }: { answers: Answers; locale: QfLocale; onEdit: (stepId: string) => void }) {
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const steps = visibleSteps(answers).filter((s) => !s.special);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{UI.reviewIntro[locale]}</p>
      {steps.map((step) => {
        const rows: { label: string; value: string }[] = [];
        for (const block of step.blocks) {
          if (!isBlockVisible(block, answers)) continue;
          if (block.kind === "field" && !block.hidden) {
            const value = displayValue(block, answers[block.id], locale, answers);
            if (value) rows.push({ label: L(block.label), value: value.length > 160 ? `${value.slice(0, 157)}…` : value });
          }
          if (block.kind === "group") {
            const list = rowsOf(answers, block.id);
            if (list.length) {
              const titles = list.map((row, i) => {
                const f = block.fields.find((x) => x.id === (block.titleField || "").split("|")[0]);
                const title = f && isRowFieldVisible(f, answers, row) ? displayValue(f, row[f.id], locale, answers) : "";
                return title || `${L(block.itemLabel)} ${i + 1}`;
              });
              rows.push({ label: L(block.label), value: titles.join(" · ") });
            }
          }
        }
        if (!rows.length) return null;
        return (
          <Card key={step.id} className="gap-2 py-4">
            <CardHeader className="flex flex-row items-center justify-between px-4">
              <CardTitle className="text-base">{L(step.title)}</CardTitle>
              <Button type="button" variant="link" size="sm" onClick={() => onEdit(step.id)}>
                {UI.edit[locale]}
              </Button>
            </CardHeader>
            <CardContent className="px-4">
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {rows.map((row, i) => (
                  <div key={i} className="contents">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StatusView({
  caseData,
  answers,
  checklist,
  docStatus,
  locale,
  justSubmitted,
  onChanged,
  onReopen,
  header,
  contact,
}: {
  caseData: CasePayload;
  answers: Answers;
  checklist: ReturnType<typeof checklistFor>;
  docStatus: Record<string, "later" | "na">;
  locale: QfLocale;
  justSubmitted: boolean;
  onChanged: () => void;
  onReopen: () => Promise<void>;
  header: React.ReactNode;
  contact: React.ReactNode;
}) {
  const [message, setMessage] = useState("");
  const [partner, setPartner] = useState({ email: "", firstName: "", lastName: "" });
  const pending = checklist.filter((item) => !caseData.files.some((f) => f.code === item.code) && docStatus[item.key] !== "na");
  const date = caseData.submittedAt ? new Date(caseData.submittedAt).toLocaleDateString("fr-CH") : "";
  return (
    <div className="flex flex-col gap-8">
      {header}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Alert>
            <AlertTitle>{justSubmitted ? UI.doneTitle[locale] : UI2.statusTitle[locale]}</AlertTitle>
            <AlertDescription>{justSubmitted ? UI.doneText[locale] : UI2.statusSubmitted[locale].replace("{date}", date)}</AlertDescription>
          </Alert>
          {caseData.deadlines.length ? (
            <Card className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-lg">{UI2.deadlinesTitle[locale]}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 px-5 text-sm">
                {caseData.deadlines.map((d) => (
                  <div key={d.id} className="flex flex-col">
                    <span className={d.level === "high" ? "font-semibold" : "font-medium"}>
                      {d.label[locale] || d.label.fr}
                      {d.date ? ` : ${d.date}` : ""}
                    </span>
                    {d.note ? <span className="text-muted-foreground">{d.note[locale] || d.note.fr}</span> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-lg">{UI2.todoTitle[locale]}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-5">
              {pending.length ? (
                <DocChecklist items={pending} files={caseData.files} docStatus={docStatus} locale={locale} clientName={`${String(answers["start.firstName"] || "")} ${String(answers["start.lastName"] || "")}`.trim()} canRemove={false} onChanged={onChanged} showExtra />
              ) : (
                <p className="text-sm text-muted-foreground">{UI2.todoNone[locale]}</p>
              )}
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={async () => {
                  await api.caseAction("additions").then(() => setMessage(UI2.additionsThanks[locale]), () => setMessage(SERVER_ERRORS.generic[locale]));
                }}
              >
                {UI2.additionsDone[locale]}
              </Button>
              {message ? <p className="text-sm text-muted-foreground" aria-live="polite">{message}</p> : null}
            </CardContent>
          </Card>
          {answers["start.household"] === "cohabiting" ? (
            <Card className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-lg">{UI2.partnerTitle[locale]}</CardTitle>
                <CardDescription>{UI2.partnerText[locale]}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 px-5 sm:grid-cols-3">
                <Input aria-label="Prénom" placeholder={locale === "de" ? "Vorname" : locale === "en" ? "First name" : "Prénom"} value={partner.firstName} onChange={(e) => setPartner((p) => ({ ...p, firstName: e.target.value }))} />
                <Input aria-label="Nom" placeholder={locale === "de" ? "Name" : locale === "en" ? "Last name" : "Nom"} value={partner.lastName} onChange={(e) => setPartner((p) => ({ ...p, lastName: e.target.value }))} />
                <Input aria-label="E-mail" type="email" placeholder="E-mail" value={partner.email} onChange={(e) => setPartner((p) => ({ ...p, email: e.target.value }))} />
                <Button type="button" className="sm:col-span-3 sm:justify-self-start" onClick={async () => {
                  await api.caseAction("partner", partner).then(() => setMessage(UI2.partnerSent[locale]), () => setMessage(SERVER_ERRORS.generic[locale]));
                }}>
                  {UI2.partnerInvite[locale]}
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <Card className="gap-3 py-5">
            <CardContent className="flex flex-col gap-3 px-5">
              <Label>{UI2.heardFrom[locale]}</Label>
              <Select onValueChange={(source) => void api.caseAction("feedback", { source })}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder={UI.choose[locale]} />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ["referral", { fr: "Recommandation", en: "Recommendation", de: "Empfehlung" }],
                    ["search", { fr: "Recherche internet", en: "Web search", de: "Internetsuche" }],
                    ["partner", { fr: "Banque, avocat, employeur", en: "Bank, lawyer, employer", de: "Bank, Anwalt, Arbeitgeber" }],
                    ["linkedin", { fr: "LinkedIn", en: "LinkedIn", de: "LinkedIn" }],
                    ["client", { fr: "Déjà client", en: "Already a client", de: "Bereits Kunde" }],
                    ["other", { fr: "Autre", en: "Other", de: "Andere" }],
                  ].map(([value, text]) => (
                    <SelectItem key={value as string} value={value as string}>
                      {(text as Record<QfLocale, string>)[locale]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Separator />
              <Button type="button" variant="ghost" className="self-start" onClick={() => void onReopen()}>
                {UI2.reopen[locale]}
              </Button>
            </CardContent>
          </Card>
        </div>
        <aside className="flex flex-col gap-4">{contact}</aside>
      </div>
    </div>
  );
}

function AiHelp({ locale, stepId }: { locale: QfLocale; stepId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="self-start">
          <Sparkle className="size-4" />
          {UI2.aiHelp[locale]}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex-col gap-2 data-[state=open]:flex">
        <Textarea rows={2} maxLength={500} value={question} onChange={(e) => setQuestion(e.target.value)} aria-label={UI2.aiAsk[locale]} placeholder={UI2.aiAsk[locale]} />
        <Button type="button" size="sm" className="self-start" disabled={loading || !question.trim()} onClick={async () => {
          setLoading(true);
          try {
            const res = await api.ai<{ answer: string }>("help", { stepId, question, locale });
            setAnswer(res.answer);
          } catch {
            setAnswer(SERVER_ERRORS.generic[locale]);
          } finally {
            setLoading(false);
          }
        }}>
          {loading ? <CircleNotch className="size-4 animate-spin" /> : null}
          OK
        </Button>
        {answer ? <p className="whitespace-pre-line rounded-md bg-surface-warm p-3 text-sm dark:bg-card">{answer}</p> : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function AiSuggest({ locale, onSuggest }: { locale: QfLocale; onSuggest: (list: Record<string, string>) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-warm p-4 dark:bg-card">
      <Label htmlFor="tqf-ai-suggest">{UI2.aiSuggestTitle[locale]}</Label>
      <Textarea id="tqf-ai-suggest" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="button" size="sm" variant="outline" className="self-start" disabled={loading || !text.trim()} onClick={async () => {
        setLoading(true);
        try {
          const res = await api.ai<{ suggestions: { item: string; reason: string }[] }>("suggest", { text, locale });
          onSuggest(Object.fromEntries(res.suggestions.map((s) => [s.item, s.reason])));
        } catch {
          onSuggest({});
        } finally {
          setLoading(false);
        }
      }}>
        {loading ? <CircleNotch className="size-4 animate-spin" /> : <Sparkle className="size-4" />}
        {UI2.aiSuggestButton[locale]}
      </Button>
    </div>
  );
}
