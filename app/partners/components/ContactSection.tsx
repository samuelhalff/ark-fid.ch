import React from "react";
import { Award } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";
import TranslatedText from "@/src/components/ui/translated-text";

const ContactSection = () => {
  return (
    <section className="bg-muted/50 rounded-xl p-8 text-center">
      <div className="max-w-2xl mx-auto">
        <Award className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-4">
          <TranslatedText
            ns="partners"
            translationKey="Contact.Title"
            fallbackText="Interested in Partnership?"
          />
        </h3>
        <p className="text-muted-foreground mb-6">
          <TranslatedText
            ns="partners"
            translationKey="Contact.Description"
            fallbackText="We're always looking for new partnership opportunities. Get in touch to explore how we can collaborate."
          />
        </p>
        <Link href="/contact">
          <Button size="lg" className="rounded-full">
            <TranslatedText
              ns="partners"
              translationKey="Contact.ButtonText"
              fallbackText="Contact Us"
            />
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default ContactSection;
