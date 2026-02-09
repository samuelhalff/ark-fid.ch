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

export type AgentChatStrings = {
  lead: {
    title: string;
    description: string;
    optionalLabel: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const updateContact = (field: keyof ContactInfo) => (value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  };

  const handleStart = () => {
    if (!emailValid) {
      setError(strings.chat.startHint);
      return;
    }
    setError(null);
    setLeadConfirmed(true);
    inputRef.current?.focus();
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

      const payload = (await res.json()) as { reply?: string };
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
    <div className="grid gap-8">
      <Card>
        <CardContent className="p-6 md:p-8 grid gap-4">
          <div>
            <p className="text-base font-semibold">{strings.lead.title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {strings.lead.description}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              {strings.lead.fields.name}{" "}
              <span className="text-xs text-muted-foreground">
                ({strings.lead.optionalLabel})
              </span>
              <Input
                value={contact.name}
                onChange={(event) => updateContact("name")(event.target.value)}
                placeholder={strings.lead.placeholders.name}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {strings.lead.fields.email}
              <Input
                value={contact.email}
                onChange={(event) => updateContact("email")(event.target.value)}
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
                onChange={(event) => updateContact("phone")(event.target.value)}
                placeholder={strings.lead.placeholders.phone}
              />
            </label>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              type="button"
              onClick={handleStart}
              disabled={!emailValid}
              className="sm:w-auto w-full"
            >
              {leadConfirmed ? strings.lead.confirmed : strings.lead.button}
            </Button>
            <p className="text-xs text-muted-foreground">{strings.disclaimer}</p>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
