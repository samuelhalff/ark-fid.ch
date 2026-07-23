"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import { getGaClientId, trackEvent } from "@/src/lib/analytics";
import { ArrowUp, CircleNotch } from "@phosphor-icons/react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type ContactInfo = {
  name: string;
  email: string;
};

type LeadMeta = {
  id: string;
  token: string;
  odooLeadId?: number;
};

type TurnstileInstance = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

export type AgentChatStrings = {
  lead: {
    title: string;
    description: string;
    helper: string;
    verificationLabel: string;
    verificationRequired: string;
    fields: {
      name: string;
      email: string;
    };
    placeholders: {
      name: string;
      email: string;
    };
    button: string;
    confirmed: string;
  };
  chat: {
    placeholder: string;
    send: string;
    thinking: string;
    error: string;
    rateLimit: string;
    startHint: string;
    invalidEmailDomain: string;
    payloadTooLarge: string;
    readyHint: string;
    reconnect: string;
    clearHistory: string;
  };
  suggestions: {
    title: string;
  };
  disclaimer: string;
};

const STORAGE_KEY = "ark-agent-chat";
const MAX_MESSAGES = 12;
const AGENT_CHAT_MESSAGE_MAX_LENGTH = 2000;
/** Storage data is considered stale and cleared after 24 hours */
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const LEAD_REQUEST_TIMEOUT_MS = 30_000;
const CHAT_REQUEST_TIMEOUT_MS = 90_000;

const defaultContact: ContactInfo = {
  name: "",
  email: "",
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createSessionId = () => {
  if (typeof window === "undefined") return createId();
  return window.crypto?.randomUUID?.() ?? createId();
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export default function AgentChat({
  strings,
  suggestions,
}: {
  strings: AgentChatStrings;
  suggestions: string[];
}) {
  const [contact, setContact] = useState<ContactInfo>(defaultContact);
  const [leadConfirmed, setLeadConfirmed] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [leadMeta, setLeadMeta] = useState<LeadMeta>({ id: "", token: "" });
  const [sessionId, setSessionId] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(true);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(
    null,
  );
  const [turnstileRenderKey, setTurnstileRenderKey] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAvailable, setReconnectAvailable] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [domainInvalid, setDomainInvalid] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  const TEXTAREA_MIN_HEIGHT = 40;
  const FALLBACK_TEXTAREA_MAX_HEIGHT = 360;
  const [textareaMaxHeight, setTextareaMaxHeight] = useState(
    FALLBACK_TEXTAREA_MAX_HEIGHT,
  );

  const turnstileSiteKey = (
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
  ).trim();
  const turnstileEnabled = turnstileSiteKey.length > 0;

  const emailValid = useMemo(
    () => isValidEmail(contact.email),
    [contact.email],
  );

  const normalizedEmail = useMemo(() => contact.email.trim(), [contact.email]);
  const normalizedName = useMemo(() => contact.name.trim(), [contact.name]);
  const inputTooLarge = input.trim().length > AGENT_CHAT_MESSAGE_MAX_LENGTH;

  const canConfirmLead = useMemo(() => {
    return (
      normalizedEmail.length > 0 && normalizedName.length > 0 && emailValid
    );
  }, [emailValid, normalizedEmail, normalizedName]);

  const leadReady = useMemo(() => {
    if (!leadConfirmed) return false;
    return (
      normalizedEmail.length > 0 &&
      emailValid &&
      confirmedEmail.length > 0 &&
      confirmedEmail === normalizedEmail &&
      leadMeta.id.length > 0 &&
      leadMeta.token.length > 0
    );
  }, [
    confirmedEmail,
    emailValid,
    leadConfirmed,
    leadMeta.id,
    leadMeta.token,
    normalizedEmail,
  ]);

  const canChat = useMemo(
    () => leadReady && !domainInvalid,
    [domainInvalid, leadReady],
  );
  const showClearHistory = chatError === strings.chat.error;
  const showModalClearHistory = modalError === strings.chat.error;

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("");
    if (typeof window !== "undefined" && turnstileWidgetId && window.turnstile) {
      window.turnstile.remove(turnstileWidgetId);
    }
    setTurnstileWidgetId(null);
    setTurnstileRenderKey((prev) => prev + 1);
  }, [turnstileWidgetId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        contact?: ContactInfo;
        messages?: Message[];
        leadConfirmed?: boolean;
        confirmedEmail?: string;
        leadId?: string;
        leadToken?: string;
        odooLeadId?: number;
        sessionId?: string;
        savedAt?: number;
      };

      // Clear stale data after 24 hours to keep the quote form fresh
      if (
        typeof saved.savedAt === "number" &&
        Date.now() - saved.savedAt > STORAGE_TTL_MS
      ) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      if (saved.contact) {
        setContact({ ...defaultContact, ...saved.contact });
      }
      if (Array.isArray(saved.messages)) {
        setMessages(saved.messages.slice(-MAX_MESSAGES));
      }
      const savedEmail =
        typeof saved.confirmedEmail === "string"
          ? saved.confirmedEmail
          : saved.contact?.email;
      const normalizedEmail = (savedEmail ?? "").trim();
      const savedLeadId = typeof saved.leadId === "string" ? saved.leadId : "";
      const savedLeadToken =
        typeof saved.leadToken === "string" ? saved.leadToken : "";
      const savedOdooLeadId =
        typeof saved.odooLeadId === "number" && Number.isFinite(saved.odooLeadId)
          ? saved.odooLeadId
          : undefined;
      const savedSessionId =
        typeof saved.sessionId === "string" ? saved.sessionId : "";

      if (
        saved.leadConfirmed &&
        isValidEmail(normalizedEmail) &&
        savedLeadId &&
        savedLeadToken
      ) {
        setLeadConfirmed(true);
        setConfirmedEmail(normalizedEmail);
        setLeadMeta({
          id: savedLeadId,
          token: savedLeadToken,
          ...(savedOdooLeadId ? { odooLeadId: savedOdooLeadId } : {}),
        });
        if (saved.contact?.email && saved.contact.email !== normalizedEmail) {
          setContact((prev) => ({ ...prev, email: normalizedEmail }));
        }
      } else if (saved.leadConfirmed) {
        setLeadConfirmed(false);
        setConfirmedEmail("");
        setLeadMeta({ id: "", token: "" });
      }

      if (savedSessionId) {
        setSessionId(savedSessionId);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Build the comparison payload without savedAt to avoid invalidating
    // the dedup check on every state change (Date.now() would always differ).
    const corePayload = {
      contact,
      messages: messages.slice(-MAX_MESSAGES),
      leadConfirmed,
      confirmedEmail,
      leadId: leadMeta.id,
      leadToken: leadMeta.token,
      odooLeadId: leadMeta.odooLeadId,
      sessionId,
    };
    try {
      const coreJson = JSON.stringify(corePayload);
      if (lastSavedRef.current === coreJson) return;
      lastSavedRef.current = coreJson;
      // Include savedAt timestamp so we can clear stale data after STORAGE_TTL_MS
      const withTimestamp = { ...corePayload, savedAt: Date.now() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withTimestamp));
    } catch {
      lastSavedRef.current = null;
    }
  }, [
    contact,
    confirmedEmail,
    leadMeta.id,
    leadMeta.odooLeadId,
    leadMeta.token,
    messages,
    leadConfirmed,
    sessionId,
  ]);

  useEffect(() => {
    if (!leadConfirmed) return;
    if (
      !normalizedEmail ||
      !emailValid ||
      !confirmedEmail ||
      normalizedEmail !== confirmedEmail ||
      !leadMeta.id ||
      !leadMeta.token
    ) {
      setLeadConfirmed(false);
      setConfirmedEmail("");
      setLeadMeta({ id: "", token: "" });
    }
  }, [
    contact.email,
    confirmedEmail,
    emailValid,
    leadConfirmed,
    leadMeta.id,
    leadMeta.token,
    normalizedEmail,
  ]);

  useEffect(() => {
    setDomainInvalid(false);
    setChatError(null);
    setModalError(null);
    setReconnectAvailable(false);
  }, [contact.email]);

  useEffect(() => {
    if (leadReady) {
      setLeadModalOpen(false);
      return;
    }
    setLeadModalOpen(true);
  }, [leadReady]);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({
      block: "end",
    });
  }, [messages, sending]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateMaxHeight = () => {
      setTextareaMaxHeight(Math.floor(window.innerHeight * 0.66));
    };
    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateOffset = () => {
      const next = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
      );
      setKeyboardOffset(next);
    };
    updateOffset();
    viewport.addEventListener("resize", updateOffset);
    viewport.addEventListener("scroll", updateOffset);
    window.addEventListener("orientationchange", updateOffset);
    return () => {
      viewport.removeEventListener("resize", updateOffset);
      viewport.removeEventListener("scroll", updateOffset);
      window.removeEventListener("orientationchange", updateOffset);
    };
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const nextHeight = Math.min(
      Math.max(el.scrollHeight, TEXTAREA_MIN_HEIGHT),
      textareaMaxHeight,
    );
    el.style.height = `${nextHeight}px`;
    el.style.overflowY =
      el.scrollHeight > textareaMaxHeight ? "auto" : "hidden";
    setIsMultiline(nextHeight > TEXTAREA_MIN_HEIGHT + 4);
  }, [input, textareaMaxHeight]);

  useEffect(() => {
    if (!turnstileEnabled) return;
    if (window.turnstile) {
      setTurnstileReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/"]',
    );
    if (existing) {
      existing.addEventListener("load", () => setTurnstileReady(true), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => setTurnstileReady(true);
    document.head.appendChild(script);
  }, [turnstileEnabled]);

  useEffect(() => {
    if (!leadModalOpen) {
      resetTurnstile();
      setModalError(null);
      return;
    }
    if (!turnstileEnabled || !turnstileReady || !turnstileRef.current) return;
    if (turnstileWidgetId || !window.turnstile) return;
    const widgetId = window.turnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => {
        setTurnstileToken(token);
        setModalError(null);
      },
      "expired-callback": () => {
        setTurnstileToken("");
        setModalError(strings.lead.verificationRequired);
      },
      "error-callback": () => setModalError(strings.lead.verificationRequired),
    });
    setTurnstileWidgetId(widgetId);
  }, [
    leadModalOpen,
    turnstileEnabled,
    turnstileReady,
    turnstileWidgetId,
    turnstileSiteKey,
    resetTurnstile,
    strings.lead.verificationRequired,
  ]);

  useEffect(() => {
    if (!leadModalOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    first?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Tab" && focusable && first && last) {
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previousFocusRef.current?.focus();
    };
  }, [leadModalOpen]);

  useEffect(() => {
    if (leadModalOpen) {
      setModalError(null);
    }
  }, [leadModalOpen]);

  const updateContact = (field: keyof ContactInfo) => (value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  };

  const requestLeadAccess = async ({
    forceNewSession = false,
    silent = false,
  }: {
    forceNewSession?: boolean;
    silent?: boolean;
  } = {}) => {
    if (normalizedEmail !== contact.email || normalizedName !== contact.name) {
      setContact((prev) => ({
        ...prev,
        email: normalizedEmail,
        name: normalizedName,
      }));
    }
    if (!canConfirmLead) {
      if (!silent) {
        setModalError(strings.chat.startHint);
      }
      return false;
    }
    if (turnstileEnabled && !turnstileToken) {
      if (!silent) {
        setModalError(strings.lead.verificationRequired);
      }
      return false;
    }

    const resolvedSessionId = forceNewSession
      ? createSessionId()
      : ensureSessionId();
    if (forceNewSession) {
      setSessionId(resolvedSessionId);
    }

    setModalError(null);
    setChatError(null);
    setReconnectAvailable(false);
    setLeadSubmitting(true);

    let requestUsedTurnstile = false;
    let connected = false;
    try {
      const { pageUrl, referrer, utm } = getRequestContext();
      requestUsedTurnstile = Boolean(turnstileToken);
      const res = await fetchWithTimeout(
        "/api/agent/chat/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...contact,
            email: normalizedEmail,
            messages: [],
            leadOnly: true,
            sessionId: resolvedSessionId,
            pageUrl,
            referrer,
            utm,
            ...(getGaClientId() ? { gaClientId: getGaClientId() } : {}),
            ...(turnstileToken ? { turnstileToken } : {}),
          }),
        },
        LEAD_REQUEST_TIMEOUT_MS,
      );
      const payload = (await res.json()) as {
        error?: string;
        leadId?: string;
        leadToken?: string;
        odooLeadId?: number;
      };

      if (!res.ok) {
        if (payload.error === "invalid_email_domain") {
          setDomainInvalid(true);
          setChatError(strings.chat.invalidEmailDomain);
          setModalError(strings.chat.invalidEmailDomain);
          return false;
        }
        if (
          payload.error === "turnstile_required" ||
          payload.error === "turnstile_failed"
        ) {
          resetTurnstile();
          setModalError(strings.lead.verificationRequired);
          return false;
        }
        setReconnectAvailable(true);
        setModalError(strings.chat.error);
        return false;
      }

      if (!payload.leadId || !payload.leadToken) {
        setReconnectAvailable(true);
        setModalError(strings.chat.error);
        return false;
      }

      setLeadConfirmed(true);
      setConfirmedEmail(normalizedEmail);
      trackEvent("generate_lead", { method: "instant_quote", form_id: "agent_lead" });
      setLeadMeta({
        id: payload.leadId,
        token: payload.leadToken,
        ...(payload.odooLeadId ? { odooLeadId: payload.odooLeadId } : {}),
      });
      setLeadModalOpen(false);
      setModalError(null);
      setReconnectAvailable(false);
      connected = true;
      inputRef.current?.focus();
      return true;
    } catch {
      setReconnectAvailable(true);
      setModalError(strings.chat.error);
      return false;
    } finally {
      if (turnstileEnabled && requestUsedTurnstile && !connected) {
        resetTurnstile();
      }
      setLeadSubmitting(false);
    }
  };

  const handleClearHistory = () => {
    setContact({ ...defaultContact });
    setLeadConfirmed(false);
    setConfirmedEmail("");
    setLeadMeta({ id: "", token: "" });
    setSessionId("");
    setLeadSubmitting(false);
    setLeadModalOpen(true);
    resetTurnstile();
    setMessages([]);
    setInput("");
    setSending(false);
    setReconnecting(false);
    setReconnectAvailable(false);
    setChatError(null);
    setModalError(null);
    setRateLimited(false);
    setDomainInvalid(false);
    lastSavedRef.current = null;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
  };

  const ensureSessionId = () => {
    if (sessionId) return sessionId;
    const nextSessionId = createSessionId();
    setSessionId(nextSessionId);
    return nextSessionId;
  };

  const getRequestContext = () => {
    if (typeof window === "undefined") {
      return {
        pageUrl: "",
        referrer: "",
        utm: {
          source: "",
          medium: "",
          campaign: "",
          term: "",
          content: "",
        },
      };
    }
    const pageUrl = window.location.href;
    const url = new URL(pageUrl);
    return {
      pageUrl,
      referrer: document.referrer || "",
      utm: {
        source: url.searchParams.get("utm_source") || "",
        medium: url.searchParams.get("utm_medium") || "",
        campaign: url.searchParams.get("utm_campaign") || "",
        term: url.searchParams.get("utm_term") || "",
        content: url.searchParams.get("utm_content") || "",
      },
    };
  };

  const handleStart = async () => {
    await requestLeadAccess();
  };

  const handleReconnect = async ({
    forceNewLead = false,
  }: {
    forceNewLead?: boolean;
  } = {}) => {
    if (reconnecting) return;

    setReconnecting(true);
    setRateLimited(false);
    setChatError(null);
    setModalError(null);

    try {
      if (!forceNewLead && leadReady) {
        setReconnectAvailable(false);
        setLeadModalOpen(false);
        inputRef.current?.focus();
        return;
      }

      setLeadConfirmed(false);
      setConfirmedEmail("");
      setLeadMeta({ id: "", token: "" });

      if (turnstileEnabled) {
        const nextSessionId = createSessionId();
        setSessionId(nextSessionId);
        resetTurnstile();
        setLeadModalOpen(true);
        return;
      }

      const connected = await requestLeadAccess({ forceNewSession: true });
      if (!connected) {
        setLeadModalOpen(true);
      }
    } finally {
      setReconnecting(false);
    }
  };

  const agentOpenTracked = useRef(false);
  useEffect(() => {
    if (agentOpenTracked.current) return;
    agentOpenTracked.current = true;
    trackEvent("agent_open");
  }, []);

  const sendMessage = async (messageText?: string) => {
    const trimmed = (messageText ?? input).trim();
    if (!trimmed || sending || sendingRef.current) return;
    if (trimmed.length > AGENT_CHAT_MESSAGE_MAX_LENGTH) {
      setChatError(strings.chat.payloadTooLarge);
      return;
    }
    if (!canChat) {
      setChatError(
        domainInvalid
          ? strings.chat.invalidEmailDomain
          : strings.chat.startHint,
      );
      return;
    }
    sendingRef.current = true;
    const resolvedSessionId = ensureSessionId();

    setChatError(null);
    setRateLimited(false);
    setReconnectAvailable(false);
    setSending(true);
    const nextMessage: Message = {
      id: createId(),
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, nextMessage].slice(-MAX_MESSAGES);
    const restoreDraft = () => {
      setMessages((prev) =>
        prev.filter((message) => message.id !== nextMessage.id),
      );
      setInput(trimmed);
    };
    setMessages(nextMessages);
    setInput("");

    try {
      const { pageUrl, referrer, utm } = getRequestContext();
      const res = await fetchWithTimeout(
        "/api/agent/chat/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...contact,
            email: normalizedEmail,
            leadId: leadMeta.id,
            leadToken: leadMeta.token,
            odooLeadId: leadMeta.odooLeadId,
            sessionId: resolvedSessionId,
            pageUrl,
            referrer,
            utm,
            messages: nextMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        },
        CHAT_REQUEST_TIMEOUT_MS,
      );

      if (res.status === 429) {
        restoreDraft();
        setRateLimited(true);
        setChatError(strings.chat.rateLimit);
        return;
      }

      const payload = (await res.json()) as { reply?: string; error?: string };
      if (payload.error === "invalid_email_domain") {
        restoreDraft();
        setDomainInvalid(true);
        setChatError(strings.chat.invalidEmailDomain);
        return;
      }
      if (payload.error === "payload_too_large") {
        restoreDraft();
        setChatError(strings.chat.payloadTooLarge);
        return;
      }
      if (
        payload.error === "lead_required" ||
        payload.error === "lead_invalid"
      ) {
        restoreDraft();
        setLeadConfirmed(false);
        setConfirmedEmail("");
        setLeadMeta({ id: "", token: "" });
        setReconnectAvailable(true);
        setChatError(strings.chat.error);
        if (turnstileEnabled) {
          const nextSessionId = createSessionId();
          setSessionId(nextSessionId);
          resetTurnstile();
          setLeadModalOpen(true);
        } else {
          void handleReconnect({ forceNewLead: true });
        }
        return;
      }
      const reply = payload.reply ?? "";
      if (!res.ok || !reply) {
        throw new Error("Agent response invalid");
      }
      if (!nextMessages.some((message) => message.role === "assistant")) {
        trackEvent("agent_first_message");
      }
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: reply },
      ]);
    } catch {
      restoreDraft();
      setReconnectAvailable(true);
      setChatError(strings.chat.error);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const handleLeadKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (canConfirmLead && !leadSubmitting && !leadConfirmed) {
      void handleStart();
    }
  };

  return (
    <>
      {/* Messages — grow with page scroll */}
      <div role="log" aria-live="polite">
        <div className="mx-auto max-w-4xl space-y-5 px-5 py-5 sm:px-8 md:py-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[75%]",
                  message.role === "user"
                    ? "bg-foreground text-background whitespace-pre-wrap dark:bg-primary dark:text-primary-foreground"
                    : "bg-surface-warm text-foreground dark:bg-card",
                )}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-[24px] bg-surface-warm px-4 py-3 text-sm text-muted-foreground shadow-sm dark:bg-card">
                <span className="sr-only">{strings.chat.thinking}</span>
                <span className="typing-dots" aria-hidden="true">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </div>
            </div>
          )}
          {/* Spacer keeps the last message above the fixed input bar */}
          <div className="h-36" aria-hidden="true" />
          <div ref={endRef} />
        </div>
      </div>

      {/* Input bar — fixed at viewport bottom, moves with mobile keyboard */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 bg-background/95 px-5 pt-3 shadow-[0_-16px_32px_rgba(20,16,14,0.06)] backdrop-blur-sm sm:px-8 dark:shadow-[0_-18px_34px_rgba(0,0,0,0.28)]"
        style={{ paddingBottom: keyboardOffset ? keyboardOffset + 20 : 20 }}
      >
        <div className="mx-auto max-w-4xl">
          {canChat &&
            suggestions.length > 0 &&
            messages.length === 0 &&
            !input.trim() && (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  {strings.suggestions.title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void sendMessage(item)}
                      className="rounded-full bg-[#f7ebe5] px-3 py-1 text-xs text-[#8c4f39] shadow-sm transition-colors hover:bg-[#f3ddd4] hover:text-[#663628] dark:bg-[#34221c] dark:text-[#f2b294] dark:hover:bg-[#412721] dark:hover:text-[#f7c8b2]"
                      disabled={sending}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          {chatError && (
            <div
              className={cn(
                "mb-2 text-xs",
                rateLimited ? "text-amber-600" : "text-red-500",
              )}
            >
              {chatError}
            </div>
          )}
          {reconnectAvailable && !rateLimited && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => void handleReconnect()}
              disabled={reconnecting || sending || leadSubmitting}
              className="mb-3 h-auto p-0 text-xs text-foreground hover:text-foreground/80"
            >
              {reconnecting ? strings.chat.thinking : strings.chat.reconnect}
            </Button>
          )}
          {showClearHistory && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleClearHistory}
              className="mb-3 h-auto p-0 text-xs text-red-500 hover:text-red-600"
            >
              {strings.chat.clearHistory}
            </Button>
          )}
          <div
            className={cn(
              "flex items-end gap-3 bg-background px-4 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.12)] dark:shadow-[0_18px_32px_rgba(0,0,0,0.34)]",
              isMultiline ? "rounded-[10px]" : "rounded-[18px]",
            )}
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (
                  event.target.value.trim().length >
                  AGENT_CHAT_MESSAGE_MAX_LENGTH
                ) {
                  setChatError(strings.chat.payloadTooLarge);
                } else if (chatError === strings.chat.payloadTooLarge) {
                  setChatError(null);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={strings.chat.placeholder}
              rows={1}
              className="resize-none overflow-hidden min-h-[40px] border-0 bg-background px-1 py-2 text-base leading-6 text-foreground placeholder:text-foreground/60 shadow-none !outline-none !ring-0 !ring-offset-0 !shadow-none focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none"
              disabled={!canChat || sending}
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void sendMessage()}
              disabled={!canChat || sending || !input.trim() || inputTooLarge}
              aria-label={strings.chat.send}
              className="self-center !rounded-full bg-[#1f1b19] text-white shadow-sm hover:bg-[#2b2521] dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
              <span className="sr-only">{strings.chat.send}</span>
              <ArrowUp className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {leadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-modal-title"
        >
          <div
            className="w-full max-w-[420px] rounded-[26px] bg-white/8 p-[12px] shadow-xl backdrop-blur-sm"
            ref={modalRef}
          >
            <div className="rounded-[20px] bg-surface-warm p-5 shadow-sm dark:bg-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p id="lead-modal-title" className="text-base font-semibold">
                    {strings.lead.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {strings.lead.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {strings.lead.helper}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 mt-4">
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>
                    {strings.lead.fields.email}
                    <span className="text-green-600 ml-0.5">*</span>
                  </span>
                  <Input
                    value={contact.email}
                    onChange={(event) =>
                      updateContact("email")(event.target.value)
                    }
                    onKeyDown={handleLeadKeyDown}
                    placeholder={strings.lead.placeholders.email}
                    type="email"
                    required
                    className="bg-background/80 focus-visible:ring-0"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>
                    {strings.lead.fields.name}
                    <span className="text-green-600 ml-0.5">*</span>
                  </span>
                  <Input
                    value={contact.name}
                    onChange={(event) =>
                      updateContact("name")(event.target.value)
                    }
                    onKeyDown={handleLeadKeyDown}
                    placeholder={strings.lead.placeholders.name}
                    required
                    className="bg-background/80 focus-visible:ring-0"
                  />
                </label>
              </div>
              {turnstileEnabled && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {strings.lead.verificationLabel}
                  </p>
                  <div className="flex justify-center">
                    <div
                      key={turnstileRenderKey}
                      ref={turnstileRef}
                      className="w-full max-w-[300px]"
                    />
                  </div>
                </div>
              )}
              {modalError && (
                <p className="text-xs text-red-500 mt-3">{modalError}</p>
              )}
              {showModalClearHistory && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={handleClearHistory}
                  className="mt-2 h-auto p-0 text-xs text-red-500 hover:text-red-600"
                >
                  {strings.chat.clearHistory}
                </Button>
              )}
              {reconnectAvailable && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => void handleReconnect()}
                  disabled={reconnecting || sending || leadSubmitting}
                  className="mt-2 h-auto p-0 text-xs text-foreground hover:text-foreground/80"
                >
                  {reconnecting ? strings.chat.thinking : strings.chat.reconnect}
                </Button>
              )}
              <div className="flex flex-col gap-3 mt-4">
                <Button
                  type="button"
                  onClick={handleStart}
                  disabled={!canConfirmLead || leadSubmitting || leadConfirmed}
                  className="w-full"
                >
                  {leadSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <CircleNotch className="size-4 animate-spin" aria-hidden />
                      {strings.chat.thinking}
                    </span>
                  ) : (
                    strings.lead.button
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {strings.disclaimer}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
