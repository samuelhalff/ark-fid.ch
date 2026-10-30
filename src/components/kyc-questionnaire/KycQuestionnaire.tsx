"use client";

import { ArrowLeft, ArrowRight, Check, CircleNotch, DownloadSimple, EnvelopeSimple, Info, Phone, SignOut } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Form } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Progress } from "@/src/components/ui/progress";
import { Separator } from "@/src/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { documentsFor } from "@/src/lib/kyc-questionnaire/documents";
import { displayValue, isBlockVisible, isRowFieldVisible, label, pruneHidden, rowsOf, rowTitle, validateAll, visibleSteps } from "@/src/lib/kyc-questionnaire/engine";
import { routeMismatch } from "@/src/lib/kyc-questionnaire/flags";
import { isPM } from "@/src/lib/kyc-questionnaire/schema";
import { KYC_LOCALES, type Answers, type DocDeclared, type DocItem, type KycLocale, type StepDef } from "@/src/lib/kyc-questionnaire/types";
import { CONTACT, SERVER_ERRORS, UI } from "@/src/lib/kyc-questionnaire/ui";
import { cn } from "@/src/lib/utils";
import { ApiError, api, newSubmitKey, PDF_URL, type CaseFile, type CasePayload } from "./api";
import { ActiveList, DocumentsStep, errorText, FileList, PickFiles, SIGNED_ACCEPT, useUploads } from "./DocumentsStep";
import { collectIssues, focusField, fromForm, issuesFromKeys, stepOfKey, stepSchema, toForm, type FormValues, type Issue } from "./form-model";
import { StepView } from "./StepView";

/**
 * Phases: "loading"; "code" (6-digit code after the link); "form" (open revision); the three
 * screens after submission (returned, awaiting_signature, signed); "message" for every dead end
 * (no link, expired session, newer version, closed case, invalid link).
 */
type Phase = "loading" | "email" | "code" | "choose" | "form" | "returned" | "awaiting_signature" | "signed" | "message";
type Message = { title: string; text: string; retry?: boolean; email?: boolean };

const err = (code: string, locale: KycLocale) => (SERVER_ERRORS[code] || SERVER_ERRORS.generic)[locale];
const asLocale = (value: unknown): KycLocale | null => ((KYC_LOCALES as readonly string[]).includes(String(value)) ? (value as KycLocale) : null);
const code = (error: unknown) => (error instanceof ApiError ? error.code : "generic");

/** The client's own language choice (FR/EN switch), kept for this tab across reloads. */
const LOCALE_KEY = "kqf-locale";
function storedLocale(): KycLocale | null {
  try {
    return asLocale(sessionStorage.getItem(LOCALE_KEY));
  } catch {
    return null;
  }
}
function storeLocale(locale: KycLocale) {
  try {
    sessionStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* storage unavailable: the case language applies after a reload */
  }
}

/** Form values without the server-owned route (it is added back from the case, never edited). */
const withoutRoute = (answers: Answers): Answers => {
  const rest = { ...answers };
  delete rest.route;
  return rest;
};

/** French typography: a space before the colon. */
const sep = (locale: KycLocale) => (locale === "fr" ? " : " : ": ");

const isCertifiedId = (item: DocItem) => item.key === "pp.id" || item.key.startsWith("pm.signer:");

export default function KycQuestionnaire({ locale: initialLocale }: { locale: KycLocale }) {
  const [locale, setLocale] = useState<KycLocale>(initialLocale);
  const userLocale = useRef(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<Message | null>(null);
  const [caseData, setCaseData] = useState<CasePayload | null>(null);
  const [maxFileBytes, setMaxFileBytes] = useState(50 * 1024 * 1024);
  const [stepId, setStepId] = useState("start");
  const [docDeclared, setDocDeclared] = useState<Record<string, DocDeclared>>({});
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string; list?: string[] } | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [revalidate, setRevalidate] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "failed"; at?: string }>({ state: "idle" });
  // Access flow: the link token stays in memory only (removed from the URL at once).
  const token = useRef("");
  const [challenge, setChallenge] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [otp, setOtp] = useState("");
  // Code requested with an e-mail address instead of a link; several forms → choice.
  const [email, setEmail] = useState("");
  const [byEmail, setByEmail] = useState(false);
  const [choices, setChoices] = useState<{ caseId: string; name: string }[]>([]);
  const [pick, setPick] = useState("");
  // Same key for every attempt of this submission (a lost response is replayed, not re-submitted).
  const submitKey = useRef(newSubmitKey());

  const route = caseData?.route || "";
  const routeRef = useRef(route);
  routeRef.current = route;
  const stepRef = useRef<StepDef | null>(null);
  const resolver: Resolver<FormValues> = useCallback(
    async (values, context, options) => {
      const step = stepRef.current;
      if (!step) return { values, errors: {} };
      return zodResolver(stepSchema(step, locale, routeRef.current))(values, context, options);
    },
    [locale],
  );
  const form = useForm<FormValues>({ resolver, defaultValues: {}, mode: "onSubmit", reValidateMode: "onChange" });
  const values = form.watch();
  const answers = useMemo<Answers>(() => ({ ...fromForm(values), route }), [values, route]);
  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[index] || steps[0];
  stepRef.current = step;
  const pruned = useMemo(() => pruneHidden(answers), [answers]);
  const items = useMemo(() => documentsFor(pruned), [pruned]);
  const files = useMemo(() => caseData?.files || [], [caseData]);
  const prefilled = useMemo(() => new Set(caseData?.prefilledIds || []), [caseData]);
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);

  const chooseLocale = (next: KycLocale) => {
    userLocale.current = true;
    storeLocale(next);
    setLocale(next);
  };

  // ---- loading: existing session first, else the link in the fragment → code ---------------------
  const showMessage = useCallback((next: Message) => {
    setMessage(next);
    setPhase("message");
  }, []);

  /** No link and no session: the client asks for a code with their e-mail address. */
  const askEmail = useCallback((note?: string) => {
    setNotice(note ? { tone: "info", text: note } : null);
    setOtp("");
    setPhase("email");
  }, []);

  /** Dead ends of the case API (expired session, newer version, closed case). */
  const fatal = useCallback(
    (error: unknown, l: KycLocale, expiredNote: string | null = UI.expiredText[l]) => {
      const c = code(error);
      if (c === "revision_superseded") return showMessage({ title: UI.supersededTitle[l], text: UI.supersededText[l] });
      if (c === "case_closed") return showMessage({ title: UI.closedTitle[l], text: UI.closedText[l] });
      if (c === "session_expired") return askEmail(expiredNote || undefined);
      showMessage({ title: UI.noLinkTitle[l], text: err(c, l), retry: true });
    },
    [showMessage, askEmail],
  );

  const applyCase = useCallback(
    (data: CasePayload, first: boolean) => {
      setCaseData(data);
      const caseLocale = asLocale(data.language);
      if (!userLocale.current && caseLocale) setLocale(caseLocale);
      if (data.state === "open") {
        if (first) {
          form.reset(toForm(withoutRoute(data.draft?.answers || data.answers || {})));
          setDocDeclared(data.draft?.docDeclared || {});
          if (data.draft?.stepId) setStepId(data.draft.stepId);
        }
        setPhase("form");
      } else {
        setPhase(data.state);
      }
    },
    [form],
  );

  const requestCode = useCallback(
    async (l: KycLocale) => {
      try {
        const res = await api.auth({ action: "link", token: token.current });
        setChallenge(res.challenge || "");
        setEmailHint(res.emailHint || "");
        const linkLocale = asLocale(res.language);
        if (!userLocale.current && linkLocale) setLocale(linkLocale);
        setOtp("");
        setByEmail(false);
        setPhase("code");
        return true;
      } catch (error) {
        const c = code(error);
        if (c === "link_invalid") showMessage({ title: UI.linkInvalidTitle[l], text: UI.linkInvalidText[l], email: true });
        else if (c === "case_closed") showMessage({ title: UI.closedTitle[l], text: UI.closedText[l] });
        else showMessage({ title: UI.noLinkTitle[l], text: err(c, l), retry: true });
        return false;
      }
    },
    [showMessage],
  );

  const start = useCallback(async () => {
    setPhase("loading");
    const l = storedLocale() || initialLocale;
    // A link always opens its own case with a fresh code: an older session in this browser (another
    // client, another revision) is closed first.
    if (token.current) {
      await api.auth({ action: "logout" }).catch(() => undefined);
      await requestCode(l);
      return;
    }
    try {
      applyCase(await api.getCase(), true);
    } catch (error) {
      fatal(error, l, null);
    }
  }, [applyCase, fatal, requestCode, initialLocale]);

  useEffect(() => {
    const chosen = storedLocale();
    if (chosen) {
      userLocale.current = true;
      setLocale(chosen);
    }
    const found = /acces=([A-Za-z0-9_-]+)/.exec(window.location.hash)?.[1];
    if (found) {
      token.current = found;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    void api.config().then((c) => c.maxFileBytes > 0 && setMaxFileBytes(c.maxFileBytes), () => undefined);
    void start();
    // Runs once: the link is read and removed from the URL on the first render only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCase = useCallback(async () => {
    try {
      applyCase(await api.getCase(), false);
    } catch (error) {
      fatal(error, locale);
    }
  }, [applyCase, fatal, locale]);

  // ---- autosave (server-side draft; nothing persistent in the browser) -----------------------------
  // Saves are serialized: a save requested while one is running runs once afterwards with the
  // latest values, so an older request can never overwrite newer answers.
  const saving = useRef<Promise<void> | null>(null);
  const savePending = useRef(false);
  // Read inside the save loop: a queued save must send the declarations of its own time, not the
  // ones captured when the running loop started.
  const declaredRef = useRef(docDeclared);
  declaredRef.current = docDeclared;
  const saveNow = useCallback(async (): Promise<void> => {
    if (phase !== "form") return;
    if (saving.current) {
      savePending.current = true;
      return saving.current;
    }
    const run = (async () => {
      do {
        savePending.current = false;
        setSave({ state: "saving" });
        try {
          const res = await api.caseAction<{ savedAt: string }>("save", { answers: withoutRoute(fromForm(form.getValues())), stepId: stepRef.current?.id, docDeclared: declaredRef.current });
          setSave({ state: "saved", at: res.savedAt });
        } catch (error) {
          setSave({ state: "failed" });
          savePending.current = false;
          if (error instanceof ApiError && (error.status === 401 || error.status === 410)) fatal(error, locale);
          else if (code(error) === "not_editable") void refreshCase();
        }
      } while (savePending.current);
    })();
    saving.current = run;
    try {
      await run;
    } finally {
      saving.current = null;
    }
  }, [phase, form, fatal, locale, refreshCase]);
  useEffect(() => {
    if (phase !== "form") return;
    const timer = setTimeout(() => void saveNow(), 1500);
    return () => clearTimeout(timer);
  }, [values, docDeclared, phase, saveNow]);

  // Language links of the site header (full page load): the draft is saved first, and the chosen
  // language wins over the case language after the reload.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target instanceof Element ? event.target.closest("a[hreflang]") : null) as HTMLAnchorElement | null;
      if (!link || link.origin !== window.location.origin) return;
      const target = asLocale(link.hreflang);
      if (target) storeLocale(target);
      if (phase !== "form") return;
      event.preventDefault();
      void saveNow().finally(() => window.location.assign(link.href));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [phase, saveNow]);

  const goTo = (id: string) => {
    setStepId(id);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- navigation ------------------------------------------------------------------------------------
  /** Shows the error summary (each field a link) and moves to the first invalid control. */
  const fail = useCallback(
    (list: Issue[], text?: string) => {
      setIssues(list);
      setNotice({ tone: "error", text: text || UI.errorSummary[locale] });
      requestAnimationFrame(() => focusField(list[0]?.name));
    },
    [locale],
  );
  const missingDocs = useCallback(
    () => items.filter((item) => item.required && !files.some((f) => f.code === item.code) && docDeclared[item.key] !== "later"),
    [items, files, docDeclared],
  );
  const stepIssues = useCallback(async (): Promise<Issue[]> => {
    const valid = await form.trigger();
    // The render-time formState snapshot is stale right after trigger(): read the live errors.
    const list = valid ? [] : collectIssues(form.control._formState.errors as Record<string, unknown>, locale, answers);
    if (stepRef.current?.special === "documents") for (const item of missingDocs()) list.push({ name: `doc:${item.key}`, label: L(item.label) });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, locale, answers, missingDocs]);

  // After a jump to another screen (server or review errors), validate it once it is rendered.
  useEffect(() => {
    if (!revalidate) return;
    const fallback = revalidate;
    setRevalidate(null);
    void stepIssues().then((list) => fail(list.length ? list : fallback));
  }, [revalidate, step.id, stepIssues, fail]);

  const next = async () => {
    setNotice(null);
    // Leaving the documents screen would hide the progress of the uploads still running.
    if (uploading) return setNotice({ tone: "error", text: UI.uploadsBusy[locale] });
    const list = await stepIssues();
    if (list.length) return fail(list);
    setIssues([]);
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
  const verify = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.auth({ action: "verify", challenge, code: otp });
      if (res.choose?.length) {
        setChoices(res.choose);
        setPick(res.pick || "");
        setPhase("choose");
        return;
      }
      applyCase(await api.getCase(), true);
    } catch (error) {
      const c = code(error);
      if (c === "revision_superseded" || c === "case_closed") fatal(error, locale);
      else setNotice({ tone: "error", text: err(c, locale) });
    } finally {
      setBusy(false);
    }
  };
  const requestEmailCode = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.auth({ action: "email", email });
      setChallenge(res.challenge || "");
      setEmailHint(res.emailHint || "");
      setOtp("");
      setByEmail(true);
      setPhase("code");
      return true;
    } catch (error) {
      setNotice({ tone: "error", text: err(code(error), locale) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const choose = async (caseId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await api.auth({ action: "pick", pick, caseId });
      applyCase(await api.getCase(), true);
    } catch (error) {
      const c = code(error);
      if (c === "otp_expired") askEmail(err(c, locale));
      else setNotice({ tone: "error", text: err(c, locale) });
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (byEmail) {
      if (await requestEmailCode()) setNotice({ tone: "info", text: UI.codeResent[locale] });
      return;
    }
    setBusy(true);
    setNotice(null);
    if (await requestCode(locale)) setNotice({ tone: "info", text: UI.codeResent[locale] });
    setBusy(false);
  };
  const logout = async () => {
    await saveNow();
    await api.auth({ action: "logout" }).catch(() => undefined);
    askEmail(UI.loggedOut[locale]);
  };

  // ---- submission ------------------------------------------------------------------------------------
  const mismatch = routeMismatch(pruned);
  const docsStepId = steps.find((s) => s.special === "documents")?.id || "h";
  const submit = async () => {
    setNotice(null);
    // Whole form first (same validator as the server), then the documents.
    const keys = Object.keys(validateAll(pruned));
    if (keys.length) {
      const target = stepOfKey(keys[0]);
      if (target) {
        goTo(target);
        setRevalidate(issuesFromKeys(keys.filter((k) => stepOfKey(k) === target), locale, answers));
        return;
      }
    }
    const missing = missingDocs();
    if (missing.length) {
      goTo(docsStepId);
      return fail(missing.map((item) => ({ name: `doc:${item.key}`, label: L(item.label) })), err("missing_documents", locale));
    }
    if (uploading) return setNotice({ tone: "error", text: UI.uploadsBusy[locale] });
    setIssues([]);
    setBusy(true);
    try {
      await saveNow();
      await api.caseAction<{ state: string; declarationId: string | null }>("submit", { answers: withoutRoute(fromForm(form.getValues())), docDeclared, submitKey: submitKey.current });
      applyCase(await api.getCase(), false);
      window.scrollTo({ top: 0 });
    } catch (error) {
      const c = code(error);
      const detail = error instanceof ApiError ? error.detail : {};
      if (c === "invalid_answers" && Array.isArray(detail.fields) && detail.fields.length) {
        const fieldKeys = detail.fields.map(String);
        const target = stepOfKey(fieldKeys[0]);
        if (target) {
          goTo(target);
          setRevalidate(issuesFromKeys(fieldKeys.filter((k) => stepOfKey(k) === target), locale, answers));
          return;
        }
      }
      if (c === "missing_documents" && Array.isArray(detail.documents)) {
        const wanted = new Set(detail.documents.map(String));
        goTo(docsStepId);
        return fail(items.filter((item) => wanted.has(item.key)).map((item) => ({ name: `doc:${item.key}`, label: L(item.label) })), err(c, locale));
      }
      if (c === "file_rejected") {
        const names = Array.isArray(detail.files) ? detail.files.map((f) => String(f).replace(/^\[[0-9a-f]{12}\] /, "")) : [];
        void refreshCase();
        goTo(docsStepId);
        return setNotice({ tone: "error", text: names.length ? UI.filesRejected[locale] : err(c, locale), list: names });
      }
      if (error instanceof ApiError && (error.status === 401 || error.status === 410)) return fatal(error, locale);
      if (c === "not_editable") return void refreshCase();
      setNotice({ tone: "error", text: err(c, locale) });
    } finally {
      setBusy(false);
    }
  };

  // ---- rendering -------------------------------------------------------------------------------------
  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="secondary">{UI.eyebrow[locale]}</Badge>
        <ToggleGroup type="single" variant="outline" size="sm" value={locale} onValueChange={(v) => asLocale(v) && chooseLocale(v as KycLocale)} aria-label={UI.language[locale]}>
          <ToggleGroupItem value="fr" lang="fr" aria-label="Français">
            FR
          </ToggleGroupItem>
          <ToggleGroupItem value="en" lang="en" aria-label="English">
            EN
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{UI.pageTitle[locale]}</h1>
      {caseData?.displayName ? <p className="text-lg font-medium">{caseData.displayName}</p> : null}
      {phase === "form" ? <p className="max-w-[60ch] text-base leading-7 text-muted-foreground">{UI.pageIntro[locale]}</p> : null}
    </div>
  );

  const noticeBox = notice ? (
    <Alert variant={notice.tone === "error" ? "destructive" : "default"} aria-live="assertive">
      <AlertDescription>
        <p>{notice.text}</p>
        {notice.tone === "error" && issues.length ? (
          <ul className="mt-2 list-disc pl-5">
            {issues.map((issue) => (
              <li key={issue.name}>
                <button type="button" className="text-left underline underline-offset-2" onClick={() => focusField(issue.name)}>
                  {issue.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {notice.list?.length ? (
          <ul className="mt-2 list-disc pl-5">
            {notice.list.map((name) => (
              <li key={name} className="break-all">
                {name}
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
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

  if (phase === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground" role="status">
        <CircleNotch className="size-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">{UI.linkOpening[locale]}</span>
      </div>
    );
  }

  if (phase === "message" && message) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{message.title}</CardTitle>
            <CardDescription className="text-base">{message.text}</CardDescription>
          </CardHeader>
          {message.retry || message.email ? (
            <CardFooter className="flex flex-wrap gap-3">
              {message.retry ? (
                <Button type="button" onClick={() => void start()}>
                  {UI.retry[locale]}
                </Button>
              ) : null}
              {message.email ? (
                <Button type="button" variant={message.retry ? "ghost" : "default"} onClick={() => askEmail()}>
                  {UI.useEmail[locale]}
                </Button>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>
        {contact}
      </div>
    );
  }

  if (phase === "email") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card className="max-w-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim() && !busy) void requestEmailCode();
            }}
            className="flex flex-col gap-6"
          >
            <CardHeader>
              <CardTitle>{UI.emailTitle[locale]}</CardTitle>
              <CardDescription className="text-base">{UI.emailText[locale]}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {noticeBox}
              <Label htmlFor="kqf-email">{UI.emailLabel[locale]}</Label>
              <Input id="kqf-email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-sm" autoFocus />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={busy || !email.trim()}>
                {busy ? <CircleNotch className="size-4 animate-spin" /> : null}
                {UI.sendCode[locale]}
              </Button>
            </CardFooter>
          </form>
        </Card>
        {contact}
      </div>
    );
  }

  if (phase === "choose") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{UI.chooseTitle[locale]}</CardTitle>
            <CardDescription className="text-base">{UI.chooseText[locale]}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {choices.map((c) => (
              <Button key={c.caseId} type="button" variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" disabled={busy} onClick={() => void choose(c.caseId)}>
                {c.name}
              </Button>
            ))}
            {noticeBox}
          </CardContent>
        </Card>
        {contact}
      </div>
    );
  }

  if (phase === "code") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card className="max-w-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (otp.length === 6 && !busy) void verify();
            }}
            className="flex flex-col gap-6"
          >
            <CardHeader>
              <CardTitle>{UI.codeTitle[locale]}</CardTitle>
              <CardDescription>{(byEmail ? UI.emailCodeText : UI.codeText)[locale].replace("{email}", emailHint)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Label htmlFor="kqf-code">{UI.codeLabel[locale]}</Label>
              <Input id="kqf-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="max-w-40 text-lg tracking-[0.3em]" autoFocus />
              {noticeBox}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy || otp.length !== 6}>
                {busy ? <CircleNotch className="size-4 animate-spin" /> : null}
                {UI.verify[locale]}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void resend()} disabled={busy}>
                {UI.resendCode[locale]}
              </Button>
              {byEmail ? (
                <Button type="button" variant="ghost" onClick={() => askEmail()} disabled={busy}>
                  {UI.otherEmail[locale]}
                </Button>
              ) : null}
            </CardFooter>
          </form>
        </Card>
        {contact}
      </div>
    );
  }

  if ((phase === "returned" || phase === "signed") && caseData) {
    const signedDate = caseData.signedAt ? new Date(caseData.signedAt).toLocaleDateString(locale === "fr" ? "fr-CH" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl tracking-tight">
              <Check className="size-6 text-brand-hover" aria-hidden="true" />
              {phase === "returned" ? UI.returnedTitle[locale] : UI.signedTitle[locale]}
            </CardTitle>
            <CardDescription className="text-base">{phase === "returned" ? UI.returnedText[locale] : UI.signedText[locale].replace("{date}", signedDate)}</CardDescription>
          </CardHeader>
          {phase === "signed" && caseData.declarationId ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">{UI.reference[locale].replace("{ref}", caseData.declarationId)}</p>
            </CardContent>
          ) : null}
        </Card>
        {contact}
      </div>
    );
  }

  if (phase === "awaiting_signature" && caseData) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <SigningView caseData={caseData} locale={locale} maxFileBytes={maxFileBytes} onChanged={refreshCase} onSigned={(data) => applyCase(data, false)} onFatal={(error) => fatal(error, locale)} />
        {contact}
      </div>
    );
  }

  // phase "form"
  const progress = Math.round(((index + 1) / Math.max(steps.length, 1)) * 100);
  const stepLabel = UI.stepOf[locale].replace("{n}", String(index + 1)).replace("{total}", String(steps.length));
  const special = step.special;

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
            <span className="font-medium">{stepLabel}</span>
            <span className="text-muted-foreground" aria-live="polite">
              {save.state === "saving"
                ? UI.saving[locale]
                : save.state === "saved" && save.at
                  ? UI.savedAt[locale].replace("{time}", new Date(save.at).toLocaleTimeString(locale === "fr" ? "fr-CH" : "en-GB", { hour: "2-digit", minute: "2-digit" }))
                  : save.state === "failed"
                    ? UI.saveFailed[locale]
                    : ""}
            </span>
          </div>
          <Progress value={progress} aria-label={stepLabel} />
          <StepRail steps={steps} index={index} locale={locale} onGo={(id) => goTo(id)} />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">
                {step.section ? <span className="mr-2 text-muted-foreground">{step.section}.</span> : null}
                {L(step.title)}
              </CardTitle>
              {step.intro ? <CardDescription className="text-base">{L(step.intro)}</CardDescription> : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {special === "documents" ? (
                <DocumentsStep
                  items={items}
                  files={files}
                  docDeclared={docDeclared}
                  onDeclared={(key, value) =>
                    setDocDeclared((prev) => {
                      if ((prev[key] || null) === value) return prev;
                      const nextDeclared = { ...prev };
                      if (value) nextDeclared[key] = value;
                      else delete nextDeclared[key];
                      return nextDeclared;
                    })
                  }
                  locale={locale}
                  maxFileBytes={maxFileBytes}
                  beforeUpload={saveNow}
                  onChanged={refreshCase}
                  onBusy={setUploading}
                  missing={new Set(issues.filter((i) => i.name.startsWith("doc:")).map((i) => i.name.slice(4)))}
                />
              ) : special === "review" ? (
                <ReviewSummary answers={pruned} items={items} files={files} docDeclared={docDeclared} locale={locale} onEdit={goTo} />
              ) : (
                <StepView step={step} locale={locale} answers={answers} prefilled={prefilled} />
              )}

              {special === "review" && mismatch ? (
                <Alert>
                  <Info className="size-4" />
                  <AlertDescription>{UI.mismatchNote[locale]}</AlertDescription>
                </Alert>
              ) : null}
              {noticeBox}
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={back} disabled={index === 0 || busy}>
                <ArrowLeft className="size-4" />
                {UI.back[locale]}
              </Button>
              <Button type="submit" disabled={busy || (special === "review" && uploading)}>
                {busy ? <CircleNotch className="size-4 animate-spin" /> : null}
                {special === "review" ? (busy ? UI.submitting[locale] : mismatch ? UI.submitForReview[locale] : UI.submit[locale]) : UI.next[locale]}
                {special !== "review" ? <ArrowRight className="size-4" /> : null}
              </Button>
            </CardFooter>
          </Card>

          <aside className="flex flex-col gap-4">
            <Card className="gap-3 py-5">
              <CardContent className="flex flex-col gap-3 px-5 text-sm text-muted-foreground">
                <p>{UI.draftStored[locale]}</p>
                <div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
                    <SignOut className="size-4" />
                    {UI.logout[locale]}
                  </Button>
                </div>
              </CardContent>
            </Card>
            {contact}
          </aside>
        </div>
      </form>
    </Form>
  );
}

/** Progress by screen: section letters (A–I) where the screen has one, earlier screens clickable. */
function StepRail({ steps, index, locale, onGo }: { steps: StepDef[]; index: number; locale: KycLocale; onGo: (id: string) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label={UI.stepOf[locale].replace("{n}", String(index + 1)).replace("{total}", String(steps.length))}>
      {steps.map((s, i) => {
        const title = label(s.title, locale);
        const text = s.section || (s.special === "review" ? "✓" : String(i + 1));
        const current = i === index;
        const done = i < index;
        const className = cn(
          "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
          current ? "bg-primary text-primary-foreground" : done ? "bg-surface-warm text-foreground dark:bg-card" : "text-muted-foreground shadow-[inset_0_0_0_1px_rgba(20,16,14,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]",
        );
        const name = s.section ? `${UI.section[locale].replace("{letter}", s.section)}${sep(locale)}${title}` : title;
        return (
          <li key={s.id}>
            {done ? (
              <button type="button" className={cn(className, "hover:ring-2 hover:ring-ring/50")} onClick={() => onGo(s.id)} aria-label={name} title={title}>
                {text}
              </button>
            ) : (
              <span className={className} aria-current={current ? "step" : undefined} aria-label={name} title={title}>
                {text}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Read-only summary of the visible answers per section, and the status of each document. */
function ReviewSummary({
  answers,
  items,
  files,
  docDeclared,
  locale,
  onEdit,
}: {
  answers: Answers;
  items: DocItem[];
  files: CaseFile[];
  docDeclared: Record<string, DocDeclared>;
  locale: KycLocale;
  onEdit: (stepId: string) => void;
}) {
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);
  const steps = visibleSteps(answers).filter((s) => !s.special);
  const short = (value: string) => (value.length > 200 ? `${value.slice(0, 197)}…` : value);
  const docStatus = (item: DocItem) => {
    const n = files.filter((f) => f.code === item.code).length;
    if (n) return n === 1 ? UI.docUploadedOne[locale] : UI.docUploadedMany[locale].replace("{n}", String(n));
    if (docDeclared[item.key] === "later") return UI.docLater[locale];
    if (docDeclared[item.key] === "na") return UI.docNa[locale];
    return item.required ? UI.docMissing[locale] : UI.docOptionalNone[locale];
  };
  const docsStep = visibleSteps(answers).find((s) => s.special === "documents");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{UI.reviewIntro[locale]}</p>
      {steps.map((step) => {
        const rows: { label: string; value: string; sub?: { title: string; values: { label: string; value: string }[] }[] }[] = [];
        for (const block of step.blocks) {
          if (!isBlockVisible(block, answers)) continue;
          if (block.kind === "field") {
            const value = displayValue(block, answers[block.id], locale);
            if (value) rows.push({ label: L(block.label), value: short(value) });
          }
          if (block.kind === "group") {
            const list = rowsOf(answers, block.id);
            if (!list.length) continue;
            rows.push({
              label: L(block.label),
              value: "",
              sub: list.map((row, i) => ({
                title: `${L(block.itemLabel)} ${i + 1}${rowTitle(block, row) ? ` · ${rowTitle(block, row)}` : ""}`,
                values: block.fields
                  .filter((f) => isRowFieldVisible(f, answers, row))
                  .map((f) => ({ label: L(f.label), value: short(displayValue(f, row[f.id], locale)) }))
                  .filter((v) => v.value),
              })),
            });
          }
        }
        if (!rows.length) return null;
        return (
          <Card key={step.id} className="gap-2 py-4">
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
              <CardTitle className="text-base">
                {step.section ? <span className="mr-1 text-muted-foreground">{step.section}.</span> : null}
                {L(step.title)}
              </CardTitle>
              <Button type="button" variant="link" size="sm" onClick={() => onEdit(step.id)} aria-label={`${UI.edit[locale]}${sep(locale)}${L(step.title)}`}>
                {UI.edit[locale]}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4">
              {rows.map((row, i) =>
                row.sub ? (
                  <div key={i} className="flex flex-col gap-2">
                    <p className="text-sm font-medium">{row.label}</p>
                    {row.sub.map((sub, j) => (
                      <div key={j} className="rounded-md bg-surface-warm p-3 dark:bg-card">
                        <p className="mb-1 text-sm font-medium">{sub.title}</p>
                        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          {sub.values.map((v, k) => (
                            <div key={k} className="contents">
                              <dt className="text-muted-foreground">{v.label}</dt>
                              <dd className="break-words">{v.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                ) : (
                  <dl key={i} className="grid gap-x-4 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="whitespace-pre-line break-words">{row.value}</dd>
                  </dl>
                ),
              )}
            </CardContent>
          </Card>
        );
      })}
      {items.length ? (
        <Card className="gap-2 py-4">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
            <CardTitle className="text-base">
              {docsStep?.section ? <span className="mr-1 text-muted-foreground">{docsStep.section}.</span> : null}
              {UI.reviewDocs[locale]}
            </CardTitle>
            {docsStep ? (
              <Button type="button" variant="link" size="sm" onClick={() => onEdit(docsStep.id)} aria-label={`${UI.edit[locale]}${sep(locale)}${UI.reviewDocs[locale]}`}>
                {UI.edit[locale]}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="px-4">
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
              {items.map((item) => {
                const status = docStatus(item);
                const missing = status === UI.docMissing[locale];
                return (
                  <div key={item.key} className="contents">
                    <dt className="text-muted-foreground">{L(item.label)}</dt>
                    <dd className={cn("break-words", missing && "font-medium text-destructive")}>{status}</dd>
                  </div>
                );
              })}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** After submission: download the PDF, print and sign, upload the signed scan, confirm. */
function SigningView({
  caseData,
  locale,
  maxFileBytes,
  onChanged,
  onSigned,
  onFatal,
}: {
  caseData: CasePayload;
  locale: KycLocale;
  maxFileBytes: number;
  onChanged: () => void;
  onSigned: (data: CasePayload) => void;
  onFatal: (error: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const uploads = useUploads({ locale, maxFileBytes, onUploaded: onChanged, onBusy: setUploading });
  const answers = caseData.answers || {};
  const signers = isPM(answers)
    ? rowsOf(answers, "i.signers").map((row) => [String(row.lastName || "").toLocaleUpperCase("fr-CH"), String(row.firstName || ""), row.function ? `(${String(row.function)})` : ""].filter(Boolean).join(" "))
    : [];
  const postOriginals = documentsFor(answers).some(isCertifiedId);
  const signed = caseData.signedFiles || [];

  const confirm = async () => {
    setError("");
    if (!signed.length) return setError(UI.signedNone[locale]);
    setBusy(true);
    try {
      await api.caseAction("signed");
      onSigned(await api.getCase());
      window.scrollTo({ top: 0 });
    } catch (e) {
      const c = code(e);
      if (e instanceof ApiError && (e.status === 401 || e.status === 410)) return onFatal(e);
      const file = e instanceof ApiError && typeof e.detail.file === "string" ? ` (${e.detail.file})` : "";
      setError(errorText(c, locale, maxFileBytes) + file);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = (n: number, text: string) => (
    <h3 className="flex items-start gap-3 text-base font-semibold leading-snug">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground" aria-hidden="true">
        {n}
      </span>
      <span className="pt-1">{text}</span>
    </h3>
  );

  return (
    <Card className="min-w-0 max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl tracking-tight">{UI.signTitle[locale]}</CardTitle>
        <CardDescription className="text-base">{UI.signIntro[locale]}</CardDescription>
        {caseData.declarationId ? <p className="text-sm font-medium">{UI.reference[locale].replace("{ref}", caseData.declarationId)}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ol className="flex flex-col gap-6">
          <li className="flex flex-col gap-3">
            {stepTitle(1, UI.signStep1[locale])}
            <div className="pl-10">
              <Button asChild variant="outline">
                <a href={PDF_URL} download>
                  <DownloadSimple className="size-4" />
                  {UI.downloadPdf[locale]}
                </a>
              </Button>
            </div>
          </li>
          <li className="flex flex-col gap-3">
            {stepTitle(2, signers.length ? UI.signStep2Pm[locale] : UI.signStep2[locale])}
            {signers.length ? (
              <ul className="list-disc space-y-1 pl-16 text-sm">
                {signers.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            ) : null}
          </li>
          <li className="flex flex-col gap-3">
            {stepTitle(3, UI.signStep3[locale])}
            <div className="flex flex-col gap-3 pl-10">
              <FileList files={signed} locale={locale} onChanged={onChanged} />
              <ActiveList list={uploads.active.signed || []} locale={locale} onDismiss={(id) => uploads.dismiss("signed", id)} />
              <div>
                <PickFiles accept={SIGNED_ACCEPT} label={signed.length ? UI.addFiles[locale] : UI.chooseFiles[locale]} onFiles={(list) => void uploads.start("signed", { kind: "signed" }, list, SIGNED_ACCEPT)} />
              </div>
            </div>
          </li>
          <li className="flex flex-col gap-3">
            {stepTitle(4, UI.signStep4[locale])}
            <div className="flex flex-col gap-3 pl-10">
              <div>
                <Button type="button" onClick={() => void confirm()} disabled={busy || uploading}>
                  {busy ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {UI.signedDone[locale]}
                </Button>
              </div>
              {uploading ? <p className="text-sm text-muted-foreground">{UI.uploadsBusy[locale]}</p> : null}
              {error ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </li>
        </ol>
        {postOriginals ? (
          <>
            <Separator />
            <Alert>
              <EnvelopeSimple className="size-4" />
              <AlertDescription>{UI.postOriginals[locale]}</AlertDescription>
            </Alert>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
