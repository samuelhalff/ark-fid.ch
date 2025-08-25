import React from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";
import TranslatedText from "@/src/components/ui/translated-text";

const ContactSection = () => {
  return (
    <section className="bg-muted/50 rounded-xl p-8 text-center mt-12">
      <div className="max-w-2xl mx-auto">
        <MessageCircle className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-4">
          <TranslatedText
            ns="ressources"
            translationKey="Contact.Title"
            fallbackText="Questions about this article?"
          />
        </h3>
        <p className="text-muted-foreground mb-6">
          <TranslatedText
            ns="ressources"
            translationKey="Contact.Description"
            fallbackText="Our experts are here to help you understand the details and implications for your business. Get personalized advice tailored to your situation."
          />
        </p>
        <Link href="/contact">
          <Button size="lg" className="rounded-full">
            <TranslatedText
              ns="ressources"
              translationKey="Contact.ButtonText"
              fallbackText="Contact Our Team"
            />
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default ContactSection;
