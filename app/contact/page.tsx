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
    firstName: z.string().min(1, { message: t("form.errors.required") }),
    email: z.string().email({ message: t("form.errors.invalidEmail") }),
    companyName: z.string().optional(),
    phone: z.string().optional(),
    message: z
      .string()
      .min(1, { message: t("form.errors.required") })
      .max(500),
    consent: z.boolean().refine((val) => val === true, {
      message: t("form.errors.consentRequired"),
    }),
  });

const FORMSPARK_ACTION_URL = "https://submit-form.com/1e26cwX66";

const ContactForm: FC = () => {
  const { t } = useTranslation();
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
    await fetch(FORMSPARK_ACTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    });
    // The `t` function is safe to use here as it's a client-side event handler
    toast.success(t("toast.success.title"), {
      description: t("toast.success.description"),
      action: { label: t("toast.close"), onClick: () => toast.dismiss },
      duration: 5000,
      onAutoClose: goHome,
      onDismiss: goHome,
    });
  };

  return (
    <div className="p-15 xs:p-10 md:p-16 w-full max-w-5xl mx-auto">
      {/* 4. REMOVED: The <title> tag. This must be handled by the page's metadata export. */}
      <h1 className="mb-3 text-center xs:mb-14 text-2xl/7 font-bold sm:text-3xl sm:tracking-tight mt-8 animate-in fade-in duration-700">
        <TranslatedText
          translationKey="Home.Contact.Title"
          fallbackText="Get in Touch"
        />
      </h1>
      <div className="flex items-center justify-center">
        <Card className="my-8 max-w-[1200px] min-w-[350px] w-full mb-15 animate-in slide-in-from-bottom-7 duration-500">
          <CardContent>
            <Toaster position="top-center" />
            <Form {...form}>
              <form
                className="flex flex-col gap-6"
                id="contact-form"
                onSubmit={form.handleSubmit(onSubmit)}
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
                            translationKey="form.labels.name"
                            fallbackText="Name"
                          />
                          <span className="text-green-600">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          translationKey="form.labels.company"
                          fallbackText="Company name"
                        />
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                          translationKey="form.labels.phone"
                          fallbackText="Phone"
                        />
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                          translationKey="form.labels.email"
                          fallbackText="Email"
                        />
                        <span className="text-green-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                          translationKey="form.labels.message"
                          fallbackText="Message"
                        />
                        <span className="text-green-600">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={8}
                          placeholder={t("form.placeholders.message")}
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
                          />
                        </FormControl>
                        <FormLabel className="mt-0! hover:cursor-pointer">
                          <TranslatedText
                            translationKey="form.labels.consent"
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
                  <TranslatedText
                    translationKey="form.buttons.submit"
                    fallbackText="Submit"
                  />
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
