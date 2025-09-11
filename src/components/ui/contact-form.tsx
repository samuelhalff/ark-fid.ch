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
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Textarea } from "@/src/components/ui/textarea";
import { toast, Toaster } from "sonner";
import { useRouter } from "next/navigation";
import React from "react";
import { useTranslation } from "react-i18next";

// 1. Import our hydration-safe component
import TranslatedText from "@/src/components/ui/translated-text";

// We keep the types and defaults outside the component
type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

const defaultValues = {
  firstName: "",
  email: "",
  message: "",
  consent: false,
  companyName: "",
  phone: "",
};

// 2. Create a function that builds the schema, accepting the `t` function
const createFormSchema = (t: (key: string) => string) =>
  z.object({
    firstName: z.string().min(1, { message: t("Errors.Required") }),
    email: z.string().email({ message: t("Errors.InvalidEmail") }),
    companyName: z.string().optional(),
    phone: z.string().optional(),
    message: z
      .string()
      .min(1, { message: t("Errors.Required") })
      .max(500, { message: t("Errors.MaxLength") }),
    consent: z.boolean().refine((val) => val === true, {
      message: t("Errors.Consent"),
    }),
  });

const FORMSPARK_ACTION_URL = "https://submit-form.com/1e26cwX66";

// Removed duplicate ContactForm declaration. The correct one is below with props.
interface ContactFormProps {
  showTitle?: boolean;
  showSubtitle?: boolean;
}

const ContactForm: FC<ContactFormProps> = ({
  showTitle = true,
  showSubtitle = true,
}) => {
  const { t } = useTranslation("contact");
  const router = useRouter();
  const [sending, setSending] = React.useState(false);

  // 3. Memoize the schema creation so it only runs when the language changes
  const formSchema = useMemo(() => createFormSchema(t), [t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onTouched",
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setSending(true);
    const goHome = () => {
      form.reset(defaultValues);
      router.push("/");
    };
    try {
      const res = await fetch(FORMSPARK_ACTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Network response was not ok");
      toast.success(t("Form.Success"), {
        action: { label: "Close", onClick: () => toast.dismiss },
        duration: 5000,
        onAutoClose: goHome,
        onDismiss: goHome,
      });
    } catch (e) {
      toast.error(t("Form.Error") || "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-1 xs:p-10 md:p-10 w-full max-w-[var(--breakpoint-xl)] mx-auto">
      {/* 4. REMOVED: The <title> tag. This must be handled by the page's metadata export. */}
      {showTitle && (
        <h1 className="mb-3 text-center xs:mb-14 text-2xl/7 font-bold sm:text-3xl sm:tracking-tight mt-0 animate-in fade-in duration-700">
          <TranslatedText
            ns="contact"
            translationKey="Title"
            fallbackText="Get in Touch"
          />
        </h1>
      )}
      {showSubtitle && (
        <p className="w-full text-center">
          <TranslatedText
            ns="contact"
            translationKey="Subtitle"
            fallbackText="Subtitle"
          />
        </p>
      )}
      <div className="flex items-center justify-center">
        <Card className="my-8 max-w-[1200px] min-w-[350px] w-full mb-15 animate-in slide-in-from-bottom-7 duration-500">
          <CardContent>
            <Toaster position="top-center" />
            <Form {...form}>
              <form
                className="flex flex-col gap-6"
                id="contact-form"
                onSubmit={form.handleSubmit(onSubmit)}
                aria-busy={sending}
              >
                {/* 5. All hardcoded labels are replaced with the TranslatedText component */}
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem className="flex-auto">
                        <FormLabel className="form-label">
                          <TranslatedText
                            ns="contact"
                            translationKey="Form.Name"
                            fallbackText="Name"
                          />
                          <span className="text-green-600">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={t("Form.Placeholders.Name")}
                            disabled={sending}
                          />
                        </FormControl>
                        <FormMessage className="place-self-start text-primary-red m-1!" />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="form-label">
                        <TranslatedText
                          ns="contact"
                          translationKey="Form.CompanyName"
                          fallbackText="Company Name (Optional)"
                        />
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("Form.Placeholders.CompanyName")}
                          disabled={sending}
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
                        <TranslatedText
                          ns="contact"
                          translationKey="Form.Phone"
                          fallbackText="Phone Number (Optional)"
                        />
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("Form.Placeholders.Phone")}
                          disabled={sending}
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
                        <TranslatedText
                          ns="contact"
                          translationKey="Form.Email"
                          fallbackText="Email"
                        />
                        <span className="text-green-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("Form.Placeholders.Email")}
                          disabled={sending}
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
                        <TranslatedText
                          ns="contact"
                          translationKey="Form.Message"
                          fallbackText="Message"
                        />
                        <span className="text-green-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={8}
                          placeholder={t("Form.Placeholders.Message")}
                          disabled={sending}
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
                          />
                        </FormControl>
                        <FormLabel className="mt-0! hover:cursor-pointer">
                          <TranslatedText
                            ns="contact"
                            translationKey="Form.Consent"
                            fallbackText="I consent to being contacted"
                          />
                          <span className="text-green-600">*</span>
                        </FormLabel>
                      </div>
                      <FormMessage className="text-primary-red m-1! place-self-start" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  name="submit"
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
                      {t("Form.Sending") || "Sending..."}
                    </span>
                  ) : (
                    <TranslatedText
                      ns="contact"
                      translationKey="Form.Submit"
                      fallbackText="Submit"
                    />
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
