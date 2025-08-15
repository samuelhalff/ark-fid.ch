import { FC } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "sonner";
import { useNavigate } from "react-router-dom";
import React from "react";

const formSchema = z.object({
  firstName: z.string().min(1, { message: "This field is required" }),
  email: z.email({
    message: "Please enter a valid email address",
  }),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().min(1, { message: "This field is required" }).max(500),
  consent: z
    .boolean({
      message: "To submit this form, please consent to being contacted",
    })
    .refine((val) => val === true, {
      message: "To submit this form, please consent to being contacted",
    }),
});

type FormValues = {
  firstName: string;
  companyName: string;
  email: string;
  phone: string;
  consent: boolean;
  message: string;
};

const defaultValues = {
  firstName: "",
  email: "",
  message: "",
  consent: false,
};

const FORMSPARK_ACTION_URL = "https://submit-form.com/1e26cwX66";

const ContactForm: FC = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...defaultValues,
    },
    mode: "onTouched",
  });
  const [sending, setSending] = React.useState(false);
  const navigate = useNavigate();

  const onError: SubmitHandler<FormValues> = (
    data: z.infer<typeof formSchema>
  ) => {
    setSending(false);
    console.error("Form submission error:", data);
  };

  const onSubmit: SubmitHandler<FormValues> = async (
    data: z.infer<typeof formSchema>
  ) => {
    setSending(true);
    const goHome = () => {
      form.reset(defaultValues);
      navigate("/"); // Redirect to home after submission
    };
    await fetch(FORMSPARK_ACTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    });
    toast.success("Your message was sent.", {
      description: "We will get back to you as soon as possible.",
      className: "w-350 h-25 p-5",
      action: {
        label: "Close",
        onClick: () => toast.dismiss,
      },
      style: { width: 350 },
      duration: 5000,
      onAutoClose: goHome,
      onDismiss: goHome,
    });
  };

  return (
    <div className="flex items-center justify-center">
      <Card className="my-8 max-w-[1200px] min-w-[350px] w-full">
        <CardHeader className="flex flex-row items-start font-karla-bold">
          <CardTitle>Get in touch</CardTitle>
        </CardHeader>
        <CardContent>
          <Toaster position="top-center" />
          <Form {...form}>
            <form
              className="flex flex-col gap-6"
              id="contact-form"
              onSubmit={form.handleSubmit(onSubmit, onError)}
              action="https://submit-form.com/1e26cwX66"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => {
                    return (
                      <FormItem className="flex-auto">
                        <FormLabel className="form-label">
                          Name
                          <span className="text-green-600">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage className="place-self-start text-primary-red !m-1" />
                      </FormItem>
                    );
                  }}
                />
              </div>
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="form-label">Company name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage className="place-self-start text-primary-red !m-1" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="form-label">Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage className="place-self-start text-primary-red !m-1" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="form-label">
                      Email
                      <span className="text-green-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage className="place-self-start text-primary-red !m-1" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="form-label">
                      Message
                      <span className="text-green-600">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={8}
                        placeholder="Type your message here..."
                        className="field-sizing-fixed"
                      />
                    </FormControl>
                    <FormMessage className="place-self-start text-primary-red !m-1" />
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
                      <FormLabel className="!mt-0 hover:cursor-pointer">
                        I consent to being contacted by Ark Fiduciaire
                        &nbsp;&nbsp;
                        <span className="text-green-600">*</span>
                      </FormLabel>
                    </div>
                    <FormMessage className="text-primary-red !m-1 place-self-start" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                name="submit"
                disabled={sending}
                style={{ cursor: "pointer" }}
              >
                Submit
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactForm;
