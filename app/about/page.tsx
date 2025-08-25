import React from "react";
import { Building2 } from "lucide-react";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import DNAValuesSection from "@/src/components/ui/dna-values-section";
import { Metadata } from "next";
import { generateMetadataForPage } from "@/src/lib/metadata";

export const metadata: Metadata = generateMetadataForPage("/about");

export default function AboutUsPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
        <div className="w-full max-w-[1200px] text-center">
          <div className="inline-flex items-center rounded-lg bg-muted px-3 py-1 text-sm font-medium mb-6">
            <Building2 className="mr-2 h-4 w-4" />
            <TranslatedText
              ns="aboutUs"
              translationKey="Hero.Badge"
              fallbackText="Established 2025"
            />
          </div>

          <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-6">
            <TranslatedText
              ns="aboutUs"
              translationKey="Hero.Title"
              fallbackText="About Ark Fiduciaire"
            />
          </h1>

          <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight text-muted-foreground">
            <TranslatedText
              ns="aboutUs"
              translationKey="Hero.Subtitle"
              fallbackText="Born from Excellence, United for Innovation"
            />
          </h2>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6 pb-20">
        <div className="space-y-20">
          {/* Foundation Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              <TranslatedText
                ns="aboutUs"
                translationKey="Foundation.Title"
                fallbackText="Our Foundation"
              />
            </h3>
            <div className="space-y-6">
              <TranslatedTextArray
                ns="aboutUs"
                translationKey="Foundation.Content"
                fallbackText={[
                  "Our company was founded through the strategic union of established firms.",
                  "This represents years of growth and expertise coming together.",
                ]}
              />
            </div>
          </section>

          {/* DNA Section */}
          <DNAValuesSection />

          {/* Expertise Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              <TranslatedText
                ns="aboutUs"
                translationKey="Expertise.Title"
                fallbackText="Collective Expertise"
              />
            </h3>
            <div className="space-y-6">
              <TranslatedTextArray
                ns="aboutUs"
                translationKey="Expertise.Content"
                fallbackText={[
                  "Our team combines decades of experience across multiple disciplines.",
                  "This diversity enables us to serve various types of clients with expertise.",
                ]}
              />
            </div>
          </section>

          {/* Vision Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              <TranslatedText
                ns="aboutUs"
                translationKey="Vision.Title"
                fallbackText="Our Vision"
              />
            </h3>
            <div className="space-y-6">
              <TranslatedTextArray
                ns="aboutUs"
                translationKey="Vision.Content"
                fallbackText={[
                  "We envision ourselves as the trusted partner for businesses.",
                  "Through innovation and technology, we transform traditional services.",
                ]}
              />
            </div>
          </section>

          {/* Partnership Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              <TranslatedText
                ns="aboutUs"
                translationKey="Partnership.Title"
                fallbackText="The Power of Partnership"
              />
            </h3>
            <div className="space-y-6">
              <TranslatedTextArray
                ns="aboutUs"
                translationKey="Partnership.Content"
                fallbackText={[
                  "Our merger represents more than combining resources—it's about creating synergies.",
                  "This partnership approach extends to our client relationships.",
                ]}
              />
            </div>
          </section>

          {/* Future Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              <TranslatedText
                ns="aboutUs"
                translationKey="Future.Title"
                fallbackText="Looking Forward"
              />
            </h3>
            <div className="space-y-6">
              <TranslatedTextArray
                ns="aboutUs"
                translationKey="Future.Content"
                fallbackText={[
                  "We remain committed to the principles that made our founding firms successful.",
                  "The future is built on our merged expertise and shared vision.",
                ]}
              />
            </div>
          </section>

          {/* Call to Action */}
          <section className="text-center bg-primary/5 rounded-lg p-8">
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-4">
              <TranslatedText
                ns="aboutUs"
                translationKey="CTA.Title"
                fallbackText="Ready to Partner with Us?"
              />
            </h3>
            <p className="text-lg text-muted-foreground mb-6">
              <TranslatedText
                ns="aboutUs"
                translationKey="CTA.Description"
                fallbackText="Discover how our combined expertise can benefit your business."
              />
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                <TranslatedText
                  ns="aboutUs"
                  translationKey="CTA.ContactButton"
                  fallbackText="Get in Touch"
                />
              </a>
              <a
                href="/team"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <TranslatedText
                  ns="aboutUs"
                  translationKey="CTA.TeamButton"
                  fallbackText="Meet Our Team"
                />
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
