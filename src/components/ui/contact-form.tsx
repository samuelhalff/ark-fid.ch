"use client";

import { FC, useMemo } from "react";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Textarea } from "@/src/components/ui/textarea";
import React from "react";

// We keep the types and defaults outside the component
type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

const defaultValues = {
  name: "",
  email: "",
  message: "",
  consent: false,
  company: "",
  phone: "",
};

// Build the schema from provided error messages (server-supplied)
const createFormSchema = (errors: {
  required: string;
  invalidEmail: string;
  maxLength: string;
  consent: string;
}) =>
  z.object({
    name: z.string().min(1, { message: errors.required }),
    email: z.string().email({ message: errors.invalidEmail }),
    company: z.string().optional(),
    phone: z.string().optional(),
    message: z
      .string()
      .min(1, { message: errors.required })
      .max(500, { message: errors.maxLength }),
    consent: z.boolean().refine((val) => val === true, {
      message: errors.consent,
    }),
  });

const FORMSPARK_ACTION_URL = "https://submit-form.com/1e26cwX66";

interface ContactFormProps {
  showTitle?: boolean;
  showSubtitle?: boolean;
  strings: {
    title: string;
    subtitle: string;
    labels: {
      name: string;
      companyName: string;
      phone: string;
      email: string;
      message: string;
      consent: string;
      submit: string;
      sending: string;
    };
    placeholders: {
      name: string;
      companyName: string;
      phone: string;
      email: string;
      message: string;
    };
    errors: {
      required: string;
      invalidEmail: string;
      maxLength: string;
      consent: string;
    };
    toasts: {
      success: string;
      error: string;
    };
  };
  redirectPath?: string; // locale-aware redirect after success
}

const ContactForm: FC<ContactFormProps> = ({
  showTitle = true,
  showSubtitle = true,
  strings,
  redirectPath = "/",
}) => {
  const [sending, setSending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Memoize schema based on provided error strings
  const formSchema = useMemo(
    () => createFormSchema(strings.errors),
    [strings.errors]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onTouched",
  });

  // Handle form submission - validate first, then submit natively
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trigger validation
    const isValid = await form.trigger();
    if (!isValid) return;

    setSending(true);

    // Submit the form natively
    if (formRef.current) {
      formRef.current.submit();
    }
  };

  // Build redirect URL (must be absolute for Formspark)
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://ark-fid.ch";
  const redirectUrl = `${baseUrl}${redirectPath}?success=true`;

  return (
    <div className="p-1 xs:p-3 md:p-3 w-full max-w-[var(--breakpoint-xl)] mx-auto">
      {showTitle && (
        <h1 className="mb-3 text-center xs:mb-14 text-2xl/7 font-bold sm:text-3xl sm:tracking-tight mt-0 animate-in fade-in duration-700">
          {strings.title}
        </h1>
      )}
      {showSubtitle && <p className="w-full text-center">{strings.subtitle}</p>}
      <div className="flex items-center justify-center">
        <Card className="my-3 max-w-[1200px] min-w-[350px] w-full mb-15 animate-in slide-in-from-bottom-7 duration-500">
          <CardContent>
            <Form {...form}>
              <form
                ref={formRef}
                action={FORMSPARK_ACTION_URL}
                method="POST"
                className="flex flex-col gap-6"
                id="contact-form"
                onSubmit={handleSubmit}
                aria-busy={sending}
              >
                {/* Hidden redirect field for Formspark */}
                <input type="hidden" name="_redirect" value={redirectUrl} />

                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-auto">
                        <FormLabel className="form-label">
                          {strings.labels.name}
                          <span className="text-green-600">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            name="name"
                            placeholder={strings.placeholders.name}
                            disabled={sending}
                            className={"border-color-primary"}
                            required
                          />
                        </FormControl>
                        <FormMessage className="place-self-start text-primary-red m-1!" />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="form-label">
                        {strings.labels.companyName}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          name="company"
                          placeholder={strings.placeholders.companyName}
                          disabled={sending}
                          className={"border-color-primary"}
                        />
                      </FormControl>
                      <FormMessage className="place-self-start text-primary-red m-1!" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="form-label">
                        {strings.labels.phone}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          name="phone"
                          placeholder={strings.placeholders.phone}
                          disabled={sending}
                          className={"border-color-primary"}
                        />
                      </FormControl>
                      <FormMessage className="place-self-start text-primary-red m-1!" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="form-label">
                        {strings.labels.email}
                        <span className="text-green-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          name="email"
                          type="email"
                          placeholder={strings.placeholders.email}
                          disabled={sending}
                          className={"border-color-primary"}
                          required
                        />
                      </FormControl>
                      <FormMessage className="place-self-start text-primary-red m-1!" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="form-label">
                        {strings.labels.message}
                        <span className="text-green-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          name="message"
                          rows={8}
                          placeholder={strings.placeholders.message}
                          disabled={sending}
                          className={"border-color-primary"}
                          required
                        />
                      </FormControl>
                      <FormMessage className="place-self-start text-primary-red m-1!" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="consent"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <div className="flex flex-row content-center justify-items-start items-center gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={sending}
                            className="w-4 h-4 text-blue-600 bg-gray-200 border-gray-700 rounded-sm focus:ring-blue-500 dark:focus:ring-blue-700 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-800 dark:border-gray-400"
                          />
                        </FormControl>
                        <FormLabel className="mt-0! hover:cursor-pointer">
                          {strings.labels.consent}
                          <span className="text-green-600">*</span>
                        </FormLabel>
                      </div>
                      <FormMessage className="text-primary-red m-1! place-self-start" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={sending}
                  style={{ cursor: "pointer" }}
                >
                  {sending ? (
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
                      {strings.labels.sending || "Sending..."}
                    </span>
                  ) : (
                    <>{strings.labels.submit}</>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContactForm;
