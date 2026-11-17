"use client";

import { ArrowLeft, ArrowRight, Check, CircleNotch, DownloadSimple, EnvelopeSimple, Info, Phone, SignOut, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Form } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Separator } from "@/src/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import posthog from "posthog-js";
import { declaredFor, documentsFor, holdsFile } from "@/src/lib/kyc-questionnaire/documents";
import { stepText, displayValue, fieldText, isBlockAsked, isRowFieldVisible, label, missingAnswers, pruneHidden, rowsOf, rowTitle, stepById, validateAll, visibleSteps } from "@/src/lib/kyc-questionnaire/engine";
import { routeMismatch } from "@/src/lib/kyc-questionnaire/flags";
import { computedText, holderLines } from "@/src/lib/kyc-questionnaire/holders";
import { isOp, isPM } from "@/src/lib/kyc-questionnaire/schema";
import { KYC_LOCALES, type Answers, type DocDeclared, type DocItem, type KycLocale, type StepDef } from "@/src/lib/kyc-questionnaire/types";
import { CONTACT, SERVER_ERRORS, UI } from "@/src/lib/kyc-questionnaire/ui";
import { cn } from "@/src/lib/utils";
import { ApiError, api, newSubmitKey, PDF_URL, type CaseFile, type CasePayload } from "./api";
import { DocumentsStep, errorText, KycFileRows, PickFiles, SIGNED_ACCEPT, useKycUploads } from "./DocumentsStep";
import { collectIssues, focusField, fromForm, issuesFromKeys, stepOfKey, stepSchema, toForm, type FormValues, type Issue } from "./form-model";
import { StepView } from "./StepView";
import { IssueLinks, MissingAnswers, missingLabel } from "@/src/components/questionnaire/IssueList";
import { ProgressBar } from "@/src/components/questionnaire/Progress";
import { ReviewList, type ReviewRow } from "@/src/components/questionnaire/ReviewList";
import { kycFormKit } from "./kit";
import { KitProvider } from "@/src/components/questionnaire/kit";
import { SubScreenContext } from "@/src/components/questionnaire/SubScreen";
import { SignaturePad } from "./SignaturePad";
import { AUTOSAVE_IDLE_MS, saveWhenHidden } from "@/src/lib/forms/autosave";

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
/** A link replaced by a newer one: by e-mail on a date (the holder's own link), or handed over otherwise. */
const replacedMessage = (error: unknown, l: KycLocale) => {
  const detail = error instanceof ApiError ? error.detail : {};
  const at = typeof detail.at === "string" ? new Date(detail.at) : null;
  const date = at && !Number.isNaN(at.getTime()) ? at.toLocaleDateString(l === "fr" ? "fr-CH" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const text = detail.via === "email" && date ? UI.linkReplacedEmailText[l].replace("{date}", date) : UI.linkReplacedOtherText[l];
  return { title: UI.linkReplacedTitle[l], text, email: true };
};

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
/** Screen to resume a draft on: the money screen took over F and G (form of 2026-11-13); an unknown id starts over. */
const resumeStep = (id: string) => (id === "f" || id === "g" ? "e" : stepById(id) ? id : "start");
/** The screens counted in the progress: neither the start screen nor the review. */
const isCounted = (step: StepDef) => step.id !== "start" && step.special !== "review";

const isCertifiedId = (item: DocItem) => item.key === "pp.id" || item.key.startsWith("pm.signer:");

export default function KycQuestionnaire({ locale: initialLocale }: { locale: KycLocale }) {
  const [locale, setLocale] = useState<KycLocale>(initialLocale);
  const kit = useMemo(() => kycFormKit(locale), [locale]);
  const userLocale = useRef(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<Message | null>(null);
  const [caseData, setCaseData] = useState<CasePayload | null>(null);
  const [maxFileBytes, setMaxFileBytes] = useState(50 * 1024 * 1024);
  const [stepId, setStepId] = useState("start");
  // A screen pushed inside the step (a company holder of section B) hides the step's own chrome.
  const [subScreen, setSubScreen] = useState(false);
  const subScreenValue = useMemo(() => ({ open: subScreen, set: setSubScreen }), [subScreen]);
  const [docDeclared, setDocDeclared] = useState<Record<string, DocDeclared>>({});
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string; list?: string[] } | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [revalidate, setRevalidate] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "failed"; at?: string }>({ state: "idle" });
  // Access flow: the link token stays in memory only (removed from the URL at once).
  const token = useRef("");
  const assistToken = useRef("");
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistCode, setAssistCode] = useState("");
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
  const identifiedCaseId = useRef<string | null>(null);

  const identifyCase = useCallback((data: CasePayload) => {
    if (identifiedCaseId.current === data.caseId) return;
    if (identifiedCaseId.current) posthog.reset();
    posthog.identify(data.caseId);
    identifiedCaseId.current = data.caseId;
  }, []);
  const resetIdentity = useCallback(() => {
    posthog.reset();
    identifiedCaseId.current = null;
  }, []);

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
  const staffPrefillVersion = useRef(0);
  const savedAnswers = useRef<Answers>({});
  const values = form.watch();
  const answers = useMemo<Answers>(() => ({ ...fromForm(values), route }), [values, route]);
  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[index] || steps[0];
  stepRef.current = step;
  const pruned = useMemo(() => pruneHidden(answers), [answers]);
  const items = useMemo(() => documentsFor(pruned, caseData?.skippedDocuments, caseData?.officeDocuments, caseData?.extraDocuments), [pruned, caseData]);
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
      if (c === "session_expired") {
        resetIdentity();
        return askEmail(expiredNote || undefined);
      }
      showMessage({ title: UI.noLinkTitle[l], text: err(c, l), retry: true });
    },
    [showMessage, askEmail, resetIdentity],
  );

  const applyCase = useCallback(
    (data: CasePayload, first: boolean) => {
      identifyCase(data);
      setCaseData(data);
      const caseLocale = asLocale(data.language);
      if (!userLocale.current && caseLocale) setLocale(caseLocale);
      if (data.state === "open") {
        if (first) {
          form.reset(toForm(withoutRoute(data.draft?.answers || data.answers || {})));
          setDocDeclared(data.draft?.docDeclared || {});
          if (data.draft?.stepId) setStepId(resumeStep(data.draft.stepId));
          staffPrefillVersion.current = data.draft?.staffPrefillVersion || 0;
          savedAnswers.current = withoutRoute(data.draft?.answers || data.answers || {});
        }
        setPhase("form");
      } else {
        setPhase(data.state);
      }
    },
    [form, identifyCase],
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
        if (c === "link_replaced") showMessage(replacedMessage(error, l));
        else if (c === "link_expired") showMessage({ title: UI.linkExpiredTitle[l], text: UI.linkExpiredText[l], email: true });
        else if (c === "link_invalid") showMessage({ title: UI.linkInvalidTitle[l], text: UI.linkInvalidText[l], email: true });
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
    // Ark staff link (single use): opens the form with its own session, no e-mail code.
    if (assistToken.current) {
      const found = assistToken.current;
      assistToken.current = "";
      await api.auth({ action: "logout" }).catch(() => undefined);
      resetIdentity();
      try {
        await api.auth({ action: "assist", token: found });
        applyCase(await api.getCase(), true);
      } catch (error) {
        const c = code(error);
        if (c === "assist_invalid") askEmail(err(c, l));
        else fatal(error, l, null);
      }
      return;
    }
    // A link always opens its own case with a fresh code: an older session in this browser (another
    // client, another revision) is closed first.
    if (token.current) {
      await api.auth({ action: "logout" }).catch(() => undefined);
      resetIdentity();
      await requestCode(l);
      return;
    }
    try {
      applyCase(await api.getCase(), true);
    } catch (error) {
      fatal(error, l, null);
    }
  }, [applyCase, askEmail, fatal, requestCode, initialLocale, resetIdentity]);

  useEffect(() => {
    const chosen = storedLocale();
    if (chosen) {
      userLocale.current = true;
      setLocale(chosen);
    }
    const staffFound = /assist=([A-Za-z0-9_-]+)/.exec(window.location.hash)?.[1];
    if (staffFound) {
      assistToken.current = staffFound;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
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
          const outgoing = withoutRoute(fromForm(form.getValues()));
          const res = await api.caseAction<{ savedAt: string }>("save", { answers: outgoing, stepId: stepRef.current?.id, docDeclared: declaredRef.current, staffPrefillVersion: staffPrefillVersion.current });
          savedAnswers.current = outgoing;
          setSave({ state: "saved", at: res.savedAt });
        } catch (error) {
          setSave({ state: "failed" });
          savePending.current = false;
          if (error instanceof ApiError && (error.status === 401 || error.status === 410)) fatal(error, locale);
          else if (code(error) === "draft_changed") {
            try {
              const local = withoutRoute(fromForm(form.getValues()));
              const fresh = await api.getCase();
              if (fresh.state !== "open") { applyCase(fresh, false); return; }
              const remote = withoutRoute(fresh.draft?.answers || fresh.answers || {});
              const merged: Answers = { ...remote };
              for (const key of new Set([...Object.keys(savedAnswers.current), ...Object.keys(local)])) {
                if (JSON.stringify(local[key]) === JSON.stringify(savedAnswers.current[key])) continue;
                if (local[key] === undefined) delete merged[key];
                else merged[key] = local[key];
              }
              applyCase(fresh, false);
              staffPrefillVersion.current = fresh.draft?.staffPrefillVersion || 0;
              savedAnswers.current = remote;
              form.reset(toForm(merged));
              savePending.current = true;
            } catch { setSave({ state: "failed" }); }
          }
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
  }, [phase, form, fatal, locale, refreshCase, applyCase]);
  useEffect(() => {
    if (phase !== "form") return;
    const timer = setTimeout(() => void saveNow(), AUTOSAVE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [values, docDeclared, phase, saveNow]);
  useEffect(() => {
    if (phase !== "form") return;
    return saveWhenHidden(() => void saveNow());
  }, [phase, saveNow]);

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
    () => items.filter((item) => item.required && !files.some((f) => holdsFile(item, f.code)) && declaredFor(item, docDeclared) !== "later"),
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
    // Never blocked on a step: what is missing is saved as it is and checked again at the end
    // (Sam, 2026-11-03). The client fills what they can and comes back for the rest.
    const list = await stepIssues();
    setIssues([]);
    const following = steps[index + 1];
    if (following) {
      posthog.capture("kyc_qf_step_advanced", {
        step: step.id,
        has_incomplete_fields: list.length > 0,
        locale,
      });
      void saveNow();
      goTo(following.id);
      if (list.length) setNotice({ tone: "info", text: UI.stepIncomplete[locale] });
    } else if (list.length) {
      fail(list);
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
      posthog.capture("kyc_qf_access_verified", {
        access_method: byEmail ? "email" : "link",
        locale,
      });
    } catch (error) {
      const c = code(error);
      if (c === "revision_superseded" || c === "case_closed") fatal(error, locale);
      else setNotice({ tone: "error", text: err(c, locale) });
    } finally {
      setBusy(false);
    }
  };
  /** Ark staff: the short code typed on the access page opens the form without an e-mail code. */
  const openWithAssistCode = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await api.auth({ action: "assist", code: assistCode });
      applyCase(await api.getCase(), true);
    } catch (error) {
      const c = code(error);
      if (c === "case_closed") fatal(error, locale);
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
      posthog.capture("kyc_qf_access_verified", {
        access_method: "email",
        locale,
      });
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
    resetIdentity();
    askEmail(UI.loggedOut[locale]);
  };

  // ---- submission ------------------------------------------------------------------------------------
  const mismatch = routeMismatch(pruned);
  const docsStepId = steps.find((s) => s.special === "documents")?.id || "h";
  // What still blocks sending, said on the review screen before anyone presses « Envoyer ».
  const missingList =
    step.special === "review"
      ? [
          ...missingAnswers(pruned).flatMap(({ key, stepId }) =>
            issuesFromKeys([key], locale, answers).map((issue) => ({ ...issue, stepId, onGo: () => { goTo(stepId); setRevalidate([issue]); } })),
          ),
          ...missingDocs().map((item) => ({ name: `doc:${item.key}`, label: L(item.label), stepId: docsStepId, onGo: () => { goTo(docsStepId); fail([{ name: `doc:${item.key}`, label: L(item.label) }], err("missing_documents", locale)); } })),
        ]
      : [];
  const missingText = missingLabel(kit.strings, missingList.length);
  // On the start screen of a form already (partly) answered: one button to the first screen still
  // incomplete, or to the review when nothing is missing.
  const resumeTo = step.id !== "start" || !Object.keys(pruned).some((k) => (stepOfKey(k) || "start") !== "start") ? null : missingAnswers(pruned).find((m) => m.stepId !== "start")?.stepId || (missingDocs().length ? docsStepId : "review");
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
      posthog.capture("kyc_qf_submitted", { locale, route });
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
  // One line: what the form is and for whom (each said once), the language beside it.
  const header = (
    <div className="flex items-start justify-between gap-3">
      <h1 className="min-w-0 pt-0.5 text-xl font-semibold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-2xl">
        {UI.pageTitle[locale]}
        {caseData?.displayName ? <span className="font-medium text-muted-foreground">{` · ${caseData.displayName}`}</span> : null}
      </h1>
      <ToggleGroup type="single" variant="outline" size="sm" className="shrink-0" value={locale} onValueChange={(v) => asLocale(v) && chooseLocale(v as KycLocale)} aria-label={UI.language[locale]}>
        <ToggleGroupItem value="fr" lang="fr" aria-label="Français">
          FR
        </ToggleGroupItem>
        <ToggleGroupItem value="en" lang="en" aria-label="English">
          EN
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  const noticeBox = notice ? (
    <Alert variant={notice.tone === "error" ? "destructive" : "default"} aria-live="assertive">
      <AlertDescription>
        <p>{notice.text}</p>
        {notice.tone === "error" ? <IssueLinks issues={issues} /> : null}
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
        {assistOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (assistCode.trim() && !busy) void openWithAssistCode();
            }}
            className="flex max-w-xl items-end gap-3"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="kqf-assist">{UI.assistLabel[locale]}</Label>
              <Input id="kqf-assist" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} value={assistCode} onChange={(e) => setAssistCode(e.target.value)} className="w-44 uppercase tracking-widest" autoFocus />
            </div>
            <Button type="submit" variant="outline" disabled={busy || !assistCode.trim()}>
              {UI.assistSubmit[locale]}
            </Button>
          </form>
        ) : (
          <button type="button" className="w-fit text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setAssistOpen(true)}>
            {UI.assistLink[locale]}
          </button>
        )}
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
  // The numbered screens: between the start screen and the review (A to the signature).
  const counted = steps.filter(isCounted);
  const special = step.special;
  const started = step.id !== "start";

  return (
    <KitProvider kit={kit}>
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
        {!subScreen ? (
          // The numbered screens say where the client is and go to any screen; the save time beside them.
          <ProgressBar steps={counted.concat(steps.filter((s) => s.special === "review"))} current={step.id} onGo={(id) => goTo(id)} save={save} answers={answers} />
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="min-w-0">
            {subScreen ? null : (
              <CardHeader>
                <CardTitle className="text-2xl tracking-tight">{L(step.title)}</CardTitle>
                {stepText(step, answers).intro ? <CardDescription className="text-base">{L(stepText(step, answers).intro!)}</CardDescription> : null}
              </CardHeader>
            )}
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
                <>
                  <MissingAnswers items={missingList} where={(id) => { const where = id === "start" ? null : stepById(id); return where ? L(where.title) : null; }} onGo={(item) => (item as (typeof missingList)[number]).onGo()} />
                  <ReviewSummary answers={pruned} items={items} files={files} docDeclared={docDeclared} locale={locale} onEdit={goTo} />
                </>
              ) : (
                <SubScreenContext.Provider value={subScreenValue}>
                  <StepView key={step.id} step={step} locale={locale} answers={answers} prefilled={prefilled} />
                </SubScreenContext.Provider>
              )}

              {special === "review" && mismatch ? (
                <Alert>
                  <Info className="size-4" />
                  <AlertDescription>{UI.mismatchNote[locale]}</AlertDescription>
                </Alert>
              ) : null}
              {noticeBox}
            </CardContent>
            <CardFooter className={cn("flex flex-wrap items-center justify-between gap-3", subScreen && "hidden")}>
              <Button type="button" variant="outline" onClick={back} disabled={index === 0 || busy}>
                <ArrowLeft className="size-4" />
                {UI.back[locale]}
              </Button>
              <Button type="submit" disabled={busy || (special === "review" && (uploading || missingList.length > 0))}>
                {busy ? <CircleNotch className="size-4 animate-spin" /> : null}
                {special === "review" ? (busy ? UI.submitting[locale] : missingList.length ? missingText : mismatch ? UI.submitForReview[locale] : UI.submit[locale]) : UI.next[locale]}
                {special !== "review" ? <ArrowRight className="size-4" /> : null}
              </Button>
              {resumeTo ? (
                <Button type="button" variant="outline" className="w-full" onClick={() => goTo(resumeTo)}>
                  {resumeTo === "review" ? L(stepById("review")!.title) : UI.resume[locale]}
                  <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </CardFooter>
          </Card>

          <aside className="flex flex-col gap-4">
            <Card className="gap-3 py-5">
              <CardContent className="flex flex-col gap-3 px-5 text-sm text-muted-foreground">
                {started ? <p>{UI.draftStored[locale]}</p> : null}
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
    </KitProvider>
  );
}

/** The review list: every visible answer, then the status of each document; a click goes back to its screen. */
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
  const docStatus = (item: DocItem) => {
    const n = files.filter((f) => holdsFile(item, f.code)).length;
    if (n) return n === 1 ? UI.docUploadedOne[locale] : UI.docUploadedMany[locale].replace("{n}", String(n));
    if (declaredFor(item, docDeclared) === "later") return UI.docLater[locale];
    if (declaredFor(item, docDeclared) === "na") return UI.docNa[locale];
    return item.required ? UI.docMissing[locale] : UI.docOptionalNone[locale];
  };
  const rows: ReviewRow[] = [];
  for (const step of visibleSteps(answers)) {
    if (step.special === "documents") {
      for (const item of items) {
        const status = docStatus(item);
        rows.push({ label: L(item.label), value: status, stepId: step.id, missing: status === UI.docMissing[locale] });
      }
    }
    if (step.special) continue;
    for (const block of step.blocks) {
      if (!isBlockAsked(block, answers)) continue;
      if (block.kind === "field" && block.id !== "b.holdersUnknown") {
        const value = displayValue(block, answers[block.id], locale, answers);
        if (value) rows.push({ label: L(fieldText(block, answers).label), value, stepId: step.id });
      }
      if (block.kind === "group" && block.ui === "holders") {
        // The holders, indented by level, then the people the shares lead to (computed).
        const lines = holderLines(answers).map((line) => ({ depth: line.depth, text: line.text[locale] }));
        if (lines.length) rows.push({ label: L(block.label), lines, stepId: step.id });
        const computed = computedText(answers, isOp(answers));
        if (computed) rows.push({ label: (isOp(answers) ? UI.holdersComputedOp : UI.holdersComputedNonOp)[locale], value: computed[locale], stepId: step.id });
        continue;
      }
      if (block.kind === "group") {
        rowsOf(answers, block.id).forEach((row, i) => {
          const value = block.fields
            .filter((f) => isRowFieldVisible(f, answers, row))
            .map((f) => [L(f.label), displayValue(f, row[f.id], locale)])
            .filter(([, v]) => v)
            .map(([l, v]) => `${l}${sep(locale)}${v}`)
            .join("\n");
          if (value) rows.push({ label: `${L(block.itemLabel)} ${i + 1}${rowTitle(block, row) ? ` · ${rowTitle(block, row)}` : ""}`, value, stepId: step.id });
        });
      }
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{UI.reviewIntro[locale]}</p>
      <ReviewList rows={rows} onEdit={onEdit} />
    </div>
  );
}

/** After submission: sign online (one signatory), or download the PDF, sign, upload the scan, confirm. */
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
  const uploads = useKycUploads({ maxFileBytes, onUploaded: onChanged, onBusy: setUploading });
  const answers = caseData.answers || {};
  const signers = isPM(answers)
    ? rowsOf(answers, "i.signers").map((row) => [String(row.lastName || "").toLocaleUpperCase("fr-CH"), String(row.firstName || ""), row.function ? `(${String(row.function)})` : ""].filter(Boolean).join(" "))
    : [];
  const signing = caseData.signing;
  const isContact = signing?.role !== "signer" && signing?.role !== "staff";
  const postOriginals = isContact && documentsFor(answers, caseData.skippedDocuments, caseData.officeDocuments, caseData.extraDocuments).some(isCertifiedId);
  const signed = caseData.signedFiles || [];
  const mySigner = signing?.online ? signing.signers.find((s) => s.mine && !s.signed) || null : null;
  const onlineSigner = mySigner && !signing?.paperStarted ? mySigner.name : null;
  const paperAllowed = isContact && !signing?.onlineStarted;
  const othersPending = !!signing?.online && signing.signers.some((s) => !s.mine && !s.signed);
  // What really happened for each signatory: signed, signing here, the contact signing in the form, link sent (when), or nothing sent yet.
  const signerState = (s: { signed: boolean; mine: boolean; invitedAt: string | null; inForm: boolean }) =>
    s.signed
      ? UI.signerSigned[locale]
      : s.mine
        ? UI.signerWaiting[locale]
        : s.inForm
          ? UI.signerInForm[locale]
          : s.invitedAt
          ? UI.signerLinkSent[locale].replace("{date}", new Date(s.invitedAt).toLocaleDateString(locale === "fr" ? "fr-CH" : "en-GB", { day: "numeric", month: "short", timeZone: "Europe/Zurich" }))
          : UI.signerNotSent[locale];
  const [accepted, setAccepted] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [drawing, setDrawing] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState("");

  const signOnline = async () => {
    setOnlineError("");
    if (!accepted) return setOnlineError(SERVER_ERRORS.signature_not_accepted[locale]);
    setBusy(true);
    try {
      await api.caseAction("sign-online", { name: typedName, drawing, accept: true, declarationId: caseData.declarationId });
      posthog.capture("kyc_qf_signed_online", { locale });
      onSigned(await api.getCase());
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 410)) return onFatal(e);
      setOnlineError(errorText(code(e), locale, maxFileBytes));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setError("");
    if (!signed.length) return setError(UI.signedNone[locale]);
    setBusy(true);
    try {
      await api.caseAction("signed");
      posthog.capture("kyc_qf_signed_paper", { locale });
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
        <CardDescription className="text-base">{isContact ? UI.signIntro[locale] : signing?.role === "staff" ? UI.signIntroStaff[locale] : UI.signIntroSigner[locale]}</CardDescription>
        {caseData.declarationId ? <p className="text-sm font-medium">{UI.reference[locale].replace("{ref}", caseData.declarationId)}</p> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {signing && signing.online && (signing.signers.length > 1 || !isContact) ? (
          <section className="flex flex-col gap-2" aria-labelledby="kyc-signers">
            <h3 id="kyc-signers" className="text-base font-semibold">
              {UI.signersTitle[locale]}
            </h3>
            <ul className="flex flex-col gap-1 text-sm">
              {signing.signers.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  {s.mine ? <span className="text-muted-foreground">({UI.signerYou[locale]})</span> : s.emailHint ? <span className="text-muted-foreground">{s.emailHint}</span> : null}
                  <Badge variant={s.signed ? "default" : "outline"}>{signerState(s)}</Badge>
                </li>
              ))}
            </ul>
            {othersPending ? <p className="text-sm text-muted-foreground">{UI.signersInvited[locale]}</p> : null}
            {!mySigner && signing.signers.some((s) => s.mine) ? <p className="text-sm font-medium">{UI.signerDone[locale]}</p> : null}
          </section>
        ) : null}
        {mySigner && signing?.paperStarted && isContact ? <p className="text-sm text-muted-foreground">{UI.paperStartedNote[locale]}</p> : null}
        {onlineSigner ? (
          <>
            <section className="flex flex-col gap-4" aria-labelledby="kyc-online-sign">
              <h3 id="kyc-online-sign" className="text-lg font-semibold">
                {UI.onlineTitle[locale]}
              </h3>
              <p className="text-sm text-muted-foreground">{UI.onlineIntro[locale]}</p>
              <div>
                <Button asChild variant="outline">
                  <a href={PDF_URL} download>
                    <DownloadSimple className="size-4" />
                    {UI.downloadPdf[locale]}
                  </a>
                </Button>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="kyc-online-accept" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                <Label htmlFor="kyc-online-accept" className="text-sm font-normal leading-snug">
                  {UI.onlineAccept[locale]}
                </Label>
              </div>
              <div className="flex max-w-sm flex-col gap-2">
                <Label htmlFor="kyc-online-name">{UI.onlineName[locale].replace("{name}", onlineSigner)}</Label>
                <Input id="kyc-online-name" value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="name" />
              </div>
              <SignaturePad locale={locale} onChange={setDrawing} />
              <div>
                <Button type="button" onClick={() => void signOnline()} disabled={busy || uploading || !typedName.trim() || !drawing}>
                  {busy ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {UI.onlineSign[locale]}
                </Button>
              </div>
              {onlineError ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {onlineError}
                </p>
              ) : null}
            </section>
            {paperAllowed ? (
              <>
                <Separator />
                <p className="text-sm font-medium">{UI.onlineOr[locale]}</p>
              </>
            ) : null}
          </>
        ) : null}
        {paperAllowed ? (
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
              <KycFileRows files={signed} rows={uploads.rows.signed || []} locale={locale} maxFileBytes={maxFileBytes} onChanged={onChanged} onRetry={(id) => uploads.retry("signed", id)} onDismiss={(id) => uploads.dismiss("signed", id)} />
              <div>
                <PickFiles accept={SIGNED_ACCEPT} label={signed.length ? UI.addFiles[locale] : UI.chooseFiles[locale]} variant={signed.length ? "outline" : "default"} onFiles={(list) => void uploads.start("signed", list)} />
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
        ) : null}
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
