import { type Metadata } from "next";
import TranslatedText from "@/src/components/ui/translated-text";
import { Separator } from "@/src/components/ui/separator";
import TranslatedDate from "@/src/components/ui/translated-date";
import ContactInfo from "@/src/components/ui/contact-info";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Terms of Service | Ark Fiduciaire",
    description:
      "Terms of Service for Ark Fiduciaire professional accounting and advisory services in Switzerland.",
    openGraph: {
      title: "Terms of Service | Ark Fiduciaire",
      description:
        "Terms of Service for Ark Fiduciaire professional accounting and advisory services in Switzerland.",
      type: "website",
    },
  };
}

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-[var(--breakpoint-xl)]">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">
          <TranslatedText
            ns="legal"
            translationKey="Terms.Title"
            fallbackText="Terms of Service"
          />
        </h1>
        <p className="text-lg text-muted-foreground dark:text-white mb-2 mb-2">
          <TranslatedText
            ns="legal"
            translationKey="Terms.Subtitle"
            fallbackText="Our terms of service"
          />
        </p>
        <p className="text-xs text-muted-foreground dark:text-white mb-2">
          <TranslatedText
            ns="legal"
            translationKey="Terms.LastUpdated"
            fallbackText="Last updated"
          />
          :{" "}
          <TranslatedDate
            date="2025-08-25"
            options={{ year: "numeric", month: "long", day: "numeric" }}
          />
        </p>
        <Separator className="mt-6" />
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        {/* Introduction */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.Introduction.Title"
              fallbackText="Introduction"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Introduction.Content.0"
                fallbackText="Welcome to Ark Fiduciaire. These Terms of Service govern your use of our website and services."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Introduction.Content.1"
                fallbackText="By accessing or using our services, you agree to be bound by these Terms. If you disagree with any part of these terms, then you may not access our services."
              />
            </p>
          </div>
        </section>

        {/* Services */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.Services.Title"
              fallbackText="Our Services"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Services.Content.0"
                fallbackText="Ark Fiduciaire provides professional accounting, tax advisory, payroll management, and corporate services to businesses in Switzerland."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Services.Content.1"
                fallbackText="All services are provided in accordance with Swiss law and professional standards of the Swiss Expert Association for Audit, Tax and Fiduciary (EXPERTsuisse)."
              />
            </p>
          </div>
        </section>

        {/* Client Responsibilities */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.Responsibilities.Title"
              fallbackText="Client Responsibilities"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Responsibilities.Content.0"
                fallbackText="Clients must provide accurate, complete, and timely information necessary for the provision of our services."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Responsibilities.Content.1"
                fallbackText="Clients are responsible for maintaining the confidentiality of their login credentials and for all activities under their account."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Responsibilities.Content.2"
                fallbackText="Clients must comply with all applicable laws and regulations in their business operations."
              />
            </p>
          </div>
        </section>

        {/* Professional Standards */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.ProfessionalStandards.Title"
              fallbackText="Professional Standards & Confidentiality"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.ProfessionalStandards.Content.0"
                fallbackText="We maintain strict confidentiality regarding all client information in accordance with Swiss professional secrecy laws and the Federal Act on Data Protection (FADP)."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.ProfessionalStandards.Content.1"
                fallbackText="Our services are provided by qualified professionals who adhere to the highest standards of ethics and competence as required by Swiss professional associations."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.ProfessionalStandards.Content.2"
                fallbackText="We implement appropriate technical and organizational measures to protect your personal data and business information against unauthorized access, alteration, disclosure, or destruction."
              />
            </p>
          </div>
        </section>

        {/* Fees and Payment */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.Fees.Title"
              fallbackText="Fees and Payment Terms"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Fees.Intro"
                fallbackText="Service fees are established based on:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Fees.Factors.0"
                  fallbackText="Complexity and scope of services required"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Fees.Factors.1"
                  fallbackText="Time and resources allocated to your engagement"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Fees.Factors.2"
                  fallbackText="Market rates for similar professional services"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Fees.Factors.3"
                  fallbackText="Specific terms outlined in your service agreement"
                />
              </li>
            </ul>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Fees.PaymentTerms"
                fallbackText="Payment terms are typically 30 days from invoice date unless otherwise agreed. Late payment may result in interest charges and suspension of services. All fees are subject to applicable Swiss VAT."
              />
            </p>
          </div>
        </section>

        {/* Limitation of Liability */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.Liability.Title"
              fallbackText="Limitation of Liability"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Liability.Overview"
                fallbackText="Our liability is limited to the maximum extent permitted under Swiss law. We maintain professional indemnity insurance as required by our professional associations."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Liability.ExclusionsIntro"
                fallbackText="We shall not be liable for:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Liability.Exclusions.0"
                  fallbackText="Consequential, indirect, or special damages"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Liability.Exclusions.1"
                  fallbackText="Loss of profits or business opportunities"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Liability.Exclusions.2"
                  fallbackText="Damages arising from client's failure to provide accurate information"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Liability.Exclusions.3"
                  fallbackText="Force majeure events beyond our reasonable control"
                />
              </li>
            </ul>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Liability.Cap"
                fallbackText="Our total liability shall not exceed the fees paid for the specific service giving rise to the claim."
              />
            </p>
          </div>
        </section>

        {/* Termination */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.Termination.Title"
              fallbackText="Termination"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Termination.General"
                fallbackText="Either party may terminate this agreement with 30 days written notice. Immediate termination may occur in cases of:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Termination.Immediate.0"
                  fallbackText="Material breach of these Terms"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Termination.Immediate.1"
                  fallbackText="Non-payment of fees"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Termination.Immediate.2"
                  fallbackText="Circumstances that would compromise our professional independence"
                />
              </li>
            </ul>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Termination.UponTermination"
                fallbackText="Upon termination, we will:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Termination.Actions.0"
                  fallbackText="Complete work in progress (subject to payment)"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Termination.Actions.1"
                  fallbackText="Return client documents and data"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Termination.Actions.2"
                  fallbackText="Provide reasonable assistance in transition to new service providers"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.Termination.Actions.3"
                  fallbackText="Continue to maintain confidentiality obligations"
                />
              </li>
            </ul>
          </div>
        </section>

        {/* Governing Law */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.GoverningLaw.Title"
              fallbackText="Governing Law"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.GoverningLaw.Description"
                fallbackText="These Terms are governed by Swiss law. Any disputes arising from these Terms or our professional relationship shall be resolved through:"
              />
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.GoverningLaw.Resolution.0"
                  fallbackText="Good faith negotiations between the parties"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.GoverningLaw.Resolution.1"
                  fallbackText="Mediation through a recognized Swiss commercial mediation service"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Terms.GoverningLaw.Resolution.2"
                  fallbackText="If necessary, litigation before the competent Swiss courts"
                />
              </li>
            </ol>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.GoverningLaw.Jurisdiction"
                fallbackText="The place of jurisdiction is the registered office of Ark Fiduciaire in Switzerland."
              />
            </p>
          </div>
        </section>

        {/* Contact Information */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Terms.Contact.Title"
              fallbackText="Contact Information"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Contact.Description"
                fallbackText="For questions regarding these Terms of Service or our professional services, please contact us:"
              />
            </p>
            <ContactInfo />
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Terms.Contact.Commitment"
                fallbackText="We are committed to maintaining the highest standards of professional service and client satisfaction."
              />
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
