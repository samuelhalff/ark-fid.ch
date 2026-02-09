"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  companyName: string;
  phone: string;
};

type TurnstileInstance = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
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
    optionalLabel: string;
    verificationLabel: string;
    verificationRequired: string;
    fields: {
      name: string;
      email: string;
      companyName: string;
      phone: string;
    };
    placeholders: {
      name: string;
      email: string;
      companyName: string;
      phone: string;
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
  companyName: "",
  phone: "",
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);

  const turnstileSiteKey = (
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
  ).trim();
  const turnstileEnabled = turnstileSiteKey.length > 0;

  const emailValid = useMemo(() => isValidEmail(contact.email), [contact.email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        contact?: ContactInfo;
        messages?: Message[];
        leadConfirmed?: boolean;
      };
      if (saved.contact) {
        setContact({ ...defaultContact, ...saved.contact });
      }
      if (Array.isArray(saved.messages)) {
        setMessages(saved.messages.slice(-MAX_MESSAGES));
      }
      if (saved.leadConfirmed) {
        setLeadConfirmed(true);
        setConfirmedEmail(saved.contact?.email || "");
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
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [contact, messages, leadConfirmed]);

  useEffect(() => {
    if (
      !leadConfirmed ||
      !confirmedEmail ||
      !contact.email ||
      contact.email === confirmedEmail
    ) {
      return;
    }
    setLeadConfirmed(false);
    setConfirmedEmail("");
  }, [contact.email, confirmedEmail, leadConfirmed]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    if (!turnstileEnabled) return;
    if (window.turnstile) {
      setTurnstileReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/"]'
    );
    if (existing) {
      existing.addEventListener("load", () => setTurnstileReady(true), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => setTurnstileReady(true);
    document.head.appendChild(script);
  }, [turnstileEnabled]);

  useEffect(() => {
    if (!leadModalOpen) {
      setTurnstileToken("");
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
        setError(null);
      },
      "expired-callback": () => {
        setTurnstileToken("");
        setError(strings.lead.verificationRequired);
      },
      "error-callback": () => setError(strings.lead.verificationRequired),
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
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    first?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLeadModalOpen(false);
        return;
      }
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

  const updateContact = (field: keyof ContactInfo) => (value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  };

  const handleStart = async () => {
    if (!emailValid) {
      setError(strings.chat.startHint);
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      setError(strings.lead.verificationRequired);
      return;
    }
    setError(null);
    setLeadSubmitting(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...contact,
          messages: [],
          leadOnly: true,
          leadMessage: strings.lead.description,
          turnstileToken,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (payload.error === "invalid_email_domain") {
          setError(strings.chat.invalidEmailDomain);
          return;
        }
        if (
          payload.error === "turnstile_required" ||
          payload.error === "turnstile_failed"
        ) {
          setError(strings.lead.verificationRequired);
          return;
        }
        setError(strings.chat.error);
        return;
      }
      setLeadConfirmed(true);
      setConfirmedEmail(contact.email);
      setLeadModalOpen(false);
      inputRef.current?.focus();
    } catch {
      setError(strings.chat.error);
    } finally {
      setLeadSubmitting(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const trimmed = (messageText ?? input).trim();
    if (!trimmed || sending) return;
    if (!leadConfirmed || !emailValid) {
      setError(strings.chat.startHint);
      return;
    }

    setError(null);
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
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...contact,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        setError(strings.chat.rateLimit);
        return;
      }

      const payload = (await res.json()) as { reply?: string; error?: string };
      if (payload.error === "invalid_email_domain") {
        setLeadConfirmed(false);
        setError(strings.chat.invalidEmailDomain);
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
      setError(strings.chat.error);
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

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-muted/30 border border-border/40 rounded-2xl px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{strings.lead.title}</p>
          <p className="text-xs text-muted-foreground">
            {strings.lead.description}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setLeadModalOpen(true)}
          disabled={leadConfirmed}
          className="sm:w-auto w-full"
          ref={triggerRef}
        >
          {leadConfirmed ? strings.lead.confirmed : strings.lead.button}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div
            ref={scrollRef}
            className="max-h-[420px] min-h-[320px] overflow-y-auto p-6 space-y-4"
            role="log"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {strings.chat.startHint}
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[75%] whitespace-pre-wrap",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-foreground"
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 text-sm bg-muted/60 text-muted-foreground">
                  {strings.chat.thinking}
                </div>
              </div>
            )}
          </div>
          <div className="border-t px-6 py-4 space-y-3">
            {error && (
              <div
                className={cn(
                  "text-xs",
                  rateLimited ? "text-amber-600" : "text-red-500"
                )}
              >
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={strings.chat.placeholder}
                rows={3}
                className="resize-none"
                disabled={!leadConfirmed || sending}
              />
              <Button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!leadConfirmed || sending || !input.trim()}
                className="self-end"
              >
                {strings.chat.send}
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {strings.suggestions.title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void sendMessage(item)}
                      className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      disabled={!leadConfirmed || sending}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {leadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-modal-title"
          onClick={() => setLeadModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl border border-border/60"
            onClick={(event) => event.stopPropagation()}
            ref={modalRef}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  id="lead-modal-title"
                  className="text-base font-semibold"
                >
                  {strings.lead.title}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {strings.lead.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeadModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 mt-4">
              <label className="grid gap-2 text-sm font-medium">
                {strings.lead.fields.name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({strings.lead.optionalLabel})
                </span>
                <Input
                  value={contact.name}
                  onChange={(event) =>
                    updateContact("name")(event.target.value)
                  }
                  placeholder={strings.lead.placeholders.name}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                {strings.lead.fields.email}
                <Input
                  value={contact.email}
                  onChange={(event) =>
                    updateContact("email")(event.target.value)
                  }
                  placeholder={strings.lead.placeholders.email}
                  type="email"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                {strings.lead.fields.companyName}{" "}
                <span className="text-xs text-muted-foreground">
                  ({strings.lead.optionalLabel})
                </span>
                <Input
                  value={contact.companyName}
                  onChange={(event) =>
                    updateContact("companyName")(event.target.value)
                  }
                  placeholder={strings.lead.placeholders.companyName}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                {strings.lead.fields.phone}{" "}
                <span className="text-xs text-muted-foreground">
                  ({strings.lead.optionalLabel})
                </span>
                <Input
                  value={contact.phone}
                  onChange={(event) =>
                    updateContact("phone")(event.target.value)
                  }
                  placeholder={strings.lead.placeholders.phone}
                />
              </label>
            </div>
            {turnstileEnabled && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {strings.lead.verificationLabel}
                </p>
                <div ref={turnstileRef} />
              </div>
            )}
            {error && (
              <p className="text-xs text-red-500 mt-3">{error}</p>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
              <Button
                type="button"
                onClick={handleStart}
                disabled={!emailValid || leadSubmitting || leadConfirmed}
                className="sm:w-auto w-full"
              >
                {leadSubmitting ? strings.chat.thinking : strings.lead.button}
              </Button>
              <p className="text-xs text-muted-foreground">
                {strings.disclaimer}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
