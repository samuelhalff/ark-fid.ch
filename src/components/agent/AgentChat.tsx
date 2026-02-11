"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

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
    readyHint: string;
  };
  suggestions: {
    title: string;
  };
  disclaimer: string;
};

const STORAGE_KEY = "ark-agent-chat";
const MAX_MESSAGES = 12;

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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
        sessionId?: string;
      };
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
        setLeadMeta({ id: savedLeadId, token: savedLeadToken });
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
    const payload = {
      contact,
      messages: messages.slice(-MAX_MESSAGES),
      leadConfirmed,
      confirmedEmail,
      leadId: leadMeta.id,
      leadToken: leadMeta.token,
      sessionId,
    };
    try {
      const serialized = JSON.stringify(payload);
      if (lastSavedRef.current === serialized) return;
      lastSavedRef.current = serialized;
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      lastSavedRef.current = null;
    }
  }, [
    contact,
    confirmedEmail,
    leadMeta.id,
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
      setTurnstileToken("");
      setModalError(null);
      if (turnstileWidgetId && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId);
      }
      setTurnstileWidgetId(null);
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
    if (normalizedEmail !== contact.email || normalizedName !== contact.name) {
      setContact((prev) => ({
        ...prev,
        email: normalizedEmail,
        name: normalizedName,
      }));
    }
    if (!canConfirmLead) {
      setModalError(strings.chat.startHint);
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      setModalError(strings.lead.verificationRequired);
      return;
    }
    const resolvedSessionId = ensureSessionId();
    setModalError(null);
    setLeadSubmitting(true);
    try {
      const { pageUrl, referrer, utm } = getRequestContext();
      const res = await fetch("/api/agent/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: JSON.stringify({
          ...contact,
          email: normalizedEmail,
          messages: [],
          leadOnly: true,
          sessionId: resolvedSessionId,
          pageUrl,
          referrer,
          utm,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        leadId?: string;
        leadToken?: string;
      };
      if (!res.ok) {
        if (payload.error === "invalid_email_domain") {
          setDomainInvalid(true);
          setChatError(strings.chat.invalidEmailDomain);
          setModalError(strings.chat.invalidEmailDomain);
          return;
        }
        if (
          payload.error === "turnstile_required" ||
          payload.error === "turnstile_failed"
        ) {
          setModalError(strings.lead.verificationRequired);
          return;
        }
        setModalError(strings.chat.error);
        return;
      }
      if (!payload.leadId || !payload.leadToken) {
        setModalError(strings.chat.error);
        return;
      }
      setLeadConfirmed(true);
      setConfirmedEmail(normalizedEmail);
      setLeadMeta({ id: payload.leadId, token: payload.leadToken });
      setLeadModalOpen(false);
      setModalError(null);
      inputRef.current?.focus();
    } catch {
      setModalError(strings.chat.error);
    } finally {
      setLeadSubmitting(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const trimmed = (messageText ?? input).trim();
    if (!trimmed || sending) return;
    if (!canChat) {
      setChatError(
        domainInvalid
          ? strings.chat.invalidEmailDomain
          : strings.chat.startHint,
      );
      return;
    }
    const resolvedSessionId = ensureSessionId();

    setChatError(null);
    setRateLimited(false);
    setSending(true);
    const nextMessage: Message = {
      id: createId(),
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, nextMessage].slice(-MAX_MESSAGES);
    setMessages(nextMessages);
    setInput("");

    try {
      const { pageUrl, referrer, utm } = getRequestContext();
      const res = await fetch("/api/agent/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: JSON.stringify({
          ...contact,
          email: normalizedEmail,
          leadId: leadMeta.id,
          leadToken: leadMeta.token,
          sessionId: resolvedSessionId,
          pageUrl,
          referrer,
          utm,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        setChatError(strings.chat.rateLimit);
        return;
      }

      const payload = (await res.json()) as { reply?: string; error?: string };
      if (payload.error === "invalid_email_domain") {
        setDomainInvalid(true);
        setChatError(strings.chat.invalidEmailDomain);
        return;
      }
      if (
        payload.error === "lead_required" ||
        payload.error === "lead_invalid"
      ) {
        setLeadConfirmed(false);
        setConfirmedEmail("");
        setLeadMeta({ id: "", token: "" });
        setChatError(strings.chat.startHint);
        return;
      }
      const reply = payload.reply ?? "";
      if (!res.ok || !reply) {
        throw new Error("Agent response invalid");
      }
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: reply },
      ]);
    } catch {
      setChatError(strings.chat.error);
    } finally {
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
    <div className="flex flex-col">
      <div
        className="px-4 md:px-6 space-y-5"
        role="log"
        aria-live="polite"
        style={{ paddingBottom: keyboardOffset ? keyboardOffset + 12 : 12 }}
      >
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
                "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[75%]",
                message.role === "user"
                  ? "bg-primary text-primary-foreground whitespace-pre-wrap dark:bg-primary/75"
                  : "bg-foreground/6 text-foreground dark:bg-muted/70",
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
            <div className="rounded-2xl px-4 py-3 text-sm bg-muted/60 text-muted-foreground">
              <span className="sr-only">{strings.chat.thinking}</span>
              <span className="typing-dots" aria-hidden="true">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div
        className="sticky bottom-0 z-10 px-4 pb-5 pt-3 md:px-6 bg-transparent dark:bg-gradient-to-t dark:from-background dark:via-background/95 dark:to-transparent"
        style={{ 
          transform: keyboardOffset ? `translateY(-${keyboardOffset}px)` : undefined
        }}
      >
        {canChat &&
          suggestions.length > 0 &&
          messages.length === 0 &&
          !input.trim() && (
            <div className="mb-3 space-y-2">
              <p className="text-xs font-semibold text-foreground dark:text-white">
                {strings.suggestions.title}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void sendMessage(item)}
                    className="rounded-full border border-foreground/10 bg-background/80 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-foreground/5 transition-colors"
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
        <div
          className={cn(
            "mx-auto flex items-end gap-3 bg-white dark:bg-white/10 px-4 py-2 shadow-[0_14px_30px_rgba(0,0,0,0.28)] max-w-3xl",
            isMultiline ? "rounded-[10px]" : "rounded-[18px]",
          )}
        >
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={strings.chat.placeholder}
            rows={1}
            className="resize-none overflow-hidden min-h-[40px] border-0 bg-white dark:bg-foreground/15 px-1 py-2 text-base leading-6 text-foreground placeholder:text-foreground/60 dark:placeholder:text-white/60 shadow-none !outline-none !ring-0 !ring-offset-0 !shadow-none focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none"
            disabled={!canChat || sending}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void sendMessage()}
            disabled={!canChat || sending || !input.trim()}
            aria-label={strings.chat.send}
            className="self-center !rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/90"
          >
            <span className="sr-only">{strings.chat.send}</span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </Button>
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
            className="w-full max-w-[420px] rounded-[26px] bg-white/5 p-[12px] shadow-xl backdrop-blur-sm"
            ref={modalRef}
          >
            <div className="rounded-[16px] bg-background p-5">
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
                    className="!border-foreground/35 !border-opacity-100 bg-transparent focus-visible:!border-foreground/55 focus-visible:ring-0"
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
                    className="!border-foreground/35 !border-opacity-100 bg-transparent focus-visible:!border-foreground/55 focus-visible:ring-0"
                  />
                </label>
              </div>
              {turnstileEnabled && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {strings.lead.verificationLabel}
                  </p>
                  <div className="flex justify-center">
                    <div ref={turnstileRef} className="w-full max-w-[300px]" />
                  </div>
                </div>
              )}
              {modalError && (
                <p className="text-xs text-red-500 mt-3">{modalError}</p>
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
                      <svg
                        className="animate-spin size-4"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
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
    </div>
  );
}
