"use client";

import React from "react";
import {
  Building2,
  Users,
  Target,
  Lightbulb,
  CheckCircle,
  Award,
  TrendingUp,
  Handshake,
} from "lucide-react";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import TranslatedObjectArray from "@/src/components/ui/translated-object-array";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Ark Fiduciaire",
  description:
    "Learn about Ark Fiduciaire SA, born from the union of two specialized firms in 2025, bringing together decades of expertise in Swiss accounting and fiduciary services.",
};

const iconMap = [Award, Users, Lightbulb, Handshake];

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
                renderItem={(text, index) => (
                  <p
                    key={index}
                    className="text-lg leading-relaxed text-muted-foreground"
                  >
                    {text}
                  </p>
                )}
              />
            </div>
          </section>

          {/* DNA Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-4 md:leading-[2rem] tracking-tight">
              <TranslatedText
                ns="aboutUs"
                translationKey="DNA.Title"
                fallbackText="Our DNA"
              />
            </h3>
            <h4 className="text-lg font-semibold mb-8 text-muted-foreground">
              <TranslatedText
                ns="aboutUs"
                translationKey="DNA.Subtitle"
                fallbackText="The Values That Define Us"
              />
            </h4>
            <div className="grid md:grid-cols-2 gap-6">
              <TranslatedObjectArray
                ns="aboutUs"
                translationKey="DNA.Values"
                fallbackItems={[
                  {
                    Title: "Swiss Precision",
                    Desc: "We embody traditional Swiss values of accuracy and reliability.",
                  },
                  {
                    Title: "Innovation Forward",
                    Desc: "We embrace cutting-edge technology and modern methodologies.",
                  },
                  {
                    Title: "Client-Centric Approach",
                    Desc: "Our diverse team provides tailored solutions for each client.",
                  },
                  {
                    Title: "Collaborative Excellence",
                    Desc: "Our culture of collaboration drives superior results.",
                  },
                ]}
                renderItem={(item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-6 rounded-lg bg-primary/5"
                  >
                    {React.createElement(iconMap[index % iconMap.length], {
                      className: "text-blue-400 mt-1 min-w-[24px]",
                      size: 24,
                    })}
                    <div>
                      <h5 className="font-semibold text-lg mb-2">
                        {item.Title}
                      </h5>
                      <p className="text-base leading-relaxed text-muted-foreground">
                        {item.Desc}
                      </p>
                    </div>
                  </div>
                )}
              />
            </div>
          </section>

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
                renderItem={(text, index) => (
                  <p
                    key={index}
                    className="text-lg leading-relaxed text-muted-foreground"
                  >
                    {text}
                  </p>
                )}
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
                renderItem={(text, index) => (
                  <p
                    key={index}
                    className="text-lg leading-relaxed text-muted-foreground"
                  >
                    {text}
                  </p>
                )}
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
                renderItem={(text, index) => (
                  <p
                    key={index}
                    className="text-lg leading-relaxed text-muted-foreground"
                  >
                    {text}
                  </p>
                )}
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
                renderItem={(text, index) => (
                  <p
                    key={index}
                    className="text-lg leading-relaxed text-muted-foreground"
                  >
                    {text}
                  </p>
                )}
              />
            </div>
          </section>

          {/* Call to Action */}
          <section className="text-center bg-primary/5 rounded-lg p-8">
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-4">
              Ready to Partner with Us?
            </h3>
            <p className="text-lg text-muted-foreground mb-6">
              Discover how our combined expertise can benefit your business.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Get in Touch
              </a>
              <a
                href="/team"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Meet Our Team
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
