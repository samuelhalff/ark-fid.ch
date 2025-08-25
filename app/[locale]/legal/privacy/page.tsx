import { type Metadata } from "next";
import TranslatedText from "@/src/components/ui/translated-text";
import { Separator } from "@/src/components/ui/separator";
import TranslatedDate from "@/src/components/ui/translated-date";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Privacy Policy | Ark Fiduciaire",
    description:
      "Privacy Policy for Ark Fiduciaire - Data protection and privacy notice for our professional services in Switzerland.",
    openGraph: {
      title: "Privacy Policy | Ark Fiduciaire",
      description:
        "Privacy Policy for Ark Fiduciaire - Data protection and privacy notice for our professional services in Switzerland.",
      type: "website",
    },
  };
}

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-[var(--breakpoint-xl)]">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">
          <TranslatedText
            ns="legal"
            translationKey="Privacy.Title"
            fallbackText="Privacy Policy"
          />
        </h1>
        <p className="text-lg text-muted-foreground dark:text-white mb-2 mb-2">
          <TranslatedText
            ns="legal"
            translationKey="Privacy.Subtitle"
            fallbackText="Data Protection and Privacy Notice"
          />
        </p>
        <p className="text-xs text-muted-foreground dark:text-white mb-2">
          <TranslatedText
            ns="legal"
            translationKey="Privacy.LastUpdated"
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
              translationKey="Privacy.Introduction.Title"
              fallbackText="Introduction"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.Introduction.Content.0"
                fallbackText="At Ark Fiduciaire, we are committed to protecting your privacy and personal data in accordance with Swiss Federal Data Protection Act (FADP) and applicable EU regulations."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.Introduction.Content.1"
                fallbackText="This Privacy Policy explains how we collect, use, and protect your information when you use our services."
              />
            </p>
          </div>
        </section>

        {/* Data Controller */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.DataController.Title"
              fallbackText="Data Controller"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.DataController.Content"
                fallbackText="Ark Fiduciaire acts as the data controller for personal data collected and processed in connection with our professional services."
              />
            </p>
            <div className="bg-muted/50 p-6 rounded-lg">
              <p className="font-semibold">
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataController.ContactDetails"
                  fallbackText="Contact details:"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataController.CompanyName"
                  fallbackText="Ark Fiduciaire"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataController.Email"
                  fallbackText="Email: privacy@ark-fid.ch"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataController.Address"
                  fallbackText="Address: [Swiss Business Address]"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataController.Phone"
                  fallbackText="Phone: +41 XX XXX XX XX"
                />
              </p>
            </div>
          </div>
        </section>

        {/* Data We Collect */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.DataCollection.Title"
              fallbackText="Data We Collect"
            />
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataCollection.ProfessionalData.Title"
                  fallbackText="Professional Service Data:"
                />
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.ProfessionalData.Items.0"
                    fallbackText="Personal identification information (name, address, date of birth)"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.ProfessionalData.Items.1"
                    fallbackText="Contact information (email, phone, business address)"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.ProfessionalData.Items.2"
                    fallbackText="Financial information (bank details, income, expenses, assets)"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.ProfessionalData.Items.3"
                    fallbackText="Tax and social security numbers"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.ProfessionalData.Items.4"
                    fallbackText="Employment and business information"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.ProfessionalData.Items.5"
                    fallbackText="Legal and compliance documentation"
                  />
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataCollection.WebsiteData.Title"
                  fallbackText="Website Data:"
                />
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.WebsiteData.Items.0"
                    fallbackText="Technical information (IP address, browser type, device information)"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.WebsiteData.Items.1"
                    fallbackText="Usage data (pages visited, time spent, referral sources)"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.WebsiteData.Items.2"
                    fallbackText="Cookies and similar tracking technologies"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataCollection.WebsiteData.Items.3"
                    fallbackText="Contact form submissions and communications"
                  />
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Legal Basis */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.LegalBasis.Title"
              fallbackText="Legal Basis for Processing"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.LegalBasis.Description"
                fallbackText="We process your personal data based on the following legal grounds:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.LegalBasis.Grounds.0"
                  fallbackText="Contract performance: To provide professional accounting and advisory services"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.LegalBasis.Grounds.1"
                  fallbackText="Legal compliance: To meet Swiss regulatory and reporting requirements"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.LegalBasis.Grounds.2"
                  fallbackText="Legitimate interests: For business operations, fraud prevention, and service improvement"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.LegalBasis.Grounds.3"
                  fallbackText="Consent: For marketing communications and non-essential cookies (where required)"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.LegalBasis.Grounds.4"
                  fallbackText="Vital interests: To protect your or others' vital interests in emergency situations"
                />
              </li>
            </ul>
          </div>
        </section>

        {/* How We Use Your Data */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.DataUse.Title"
              fallbackText="How We Use Your Data"
            />
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataUse.ServiceDelivery.Title"
                  fallbackText="Service Delivery:"
                />
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.ServiceDelivery.Items.0"
                    fallbackText="Providing accounting, tax, payroll, and advisory services"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.ServiceDelivery.Items.1"
                    fallbackText="Preparing financial statements and reports"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.ServiceDelivery.Items.2"
                    fallbackText="Managing compliance obligations"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.ServiceDelivery.Items.3"
                    fallbackText="Communicating about your services and account"
                  />
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataUse.BusinessOperations.Title"
                  fallbackText="Business Operations:"
                />
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.BusinessOperations.Items.0"
                    fallbackText="Client relationship management"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.BusinessOperations.Items.1"
                    fallbackText="Quality assurance and professional development"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.BusinessOperations.Items.2"
                    fallbackText="Risk management and fraud prevention"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.BusinessOperations.Items.3"
                    fallbackText="Legal and regulatory compliance"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataUse.BusinessOperations.Items.4"
                    fallbackText="Business continuity and disaster recovery"
                  />
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Data Sharing */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.DataSharing.Title"
              fallbackText="Data Sharing"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.DataSharing.Description"
                fallbackText="We may share your personal data with:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSharing.Recipients.0"
                  fallbackText="Swiss tax authorities and regulatory bodies (as legally required)"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSharing.Recipients.1"
                  fallbackText="Banks and financial institutions (for payment processing)"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSharing.Recipients.2"
                  fallbackText="Professional service providers (auditors, legal counsel, IT support)"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSharing.Recipients.3"
                  fallbackText="Odoo SA and certified partners (for ERP services)"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSharing.Recipients.4"
                  fallbackText="Cloud service providers with appropriate safeguards"
                />
              </li>
            </ul>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.DataSharing.Policy"
                fallbackText="We do not sell personal data to third parties. All sharing is conducted with appropriate confidentiality agreements and data protection measures in place."
              />
            </p>
          </div>
        </section>

        {/* Data Security */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.DataSecurity.Title"
              fallbackText="Data Security"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.DataSecurity.Description"
                fallbackText="We implement comprehensive security measures including:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSecurity.Measures.0"
                  fallbackText="Encryption of data in transit and at rest"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSecurity.Measures.1"
                  fallbackText="Multi-factor authentication and access controls"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSecurity.Measures.2"
                  fallbackText="Regular security assessments and updates"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSecurity.Measures.3"
                  fallbackText="Staff training on data protection"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSecurity.Measures.4"
                  fallbackText="Secure backup and disaster recovery procedures"
                />
              </li>
            </ul>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.DataSecurity.Retention.Title"
                  fallbackText="Data Retention:"
                />
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataSecurity.Retention.Professional"
                    fallbackText="Professional service records: As required by Swiss law (typically 10 years)"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataSecurity.Retention.Financial"
                    fallbackText="Financial and tax records: As mandated by regulatory requirements"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataSecurity.Retention.Website"
                    fallbackText="Website data: For the duration necessary to fulfill stated purposes"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.DataSecurity.Retention.Marketing"
                    fallbackText="Marketing data: Until consent is withdrawn or data is no longer needed"
                  />
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Your Rights */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.YourRights.Title"
              fallbackText="Your Rights"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.YourRights.Description"
                fallbackText="Under Swiss data protection law, you have the right to:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.YourRights.Access.Title"
                    fallbackText="Access:"
                  />
                </strong>{" "}
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.YourRights.Access.Description"
                  fallbackText="Request information about personal data we hold about you"
                />
              </li>
              <li>
                <strong>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.YourRights.Rectification.Title"
                    fallbackText="Rectification:"
                  />
                </strong>{" "}
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.YourRights.Rectification.Description"
                  fallbackText="Correct inaccurate or incomplete personal data"
                />
              </li>
              <li>
                <strong>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.YourRights.Erasure.Title"
                    fallbackText="Erasure:"
                  />
                </strong>{" "}
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.YourRights.Erasure.Description"
                  fallbackText="Request deletion of personal data (subject to legal obligations)"
                />
              </li>
              <li>
                <strong>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.YourRights.Restriction.Title"
                    fallbackText="Restriction:"
                  />
                </strong>{" "}
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.YourRights.Restriction.Description"
                  fallbackText="Limit processing in certain circumstances"
                />
              </li>
              <li>
                <strong>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.YourRights.Portability.Title"
                    fallbackText="Data portability:"
                  />
                </strong>{" "}
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.YourRights.Portability.Description"
                  fallbackText="Receive your data in a structured, machine-readable format"
                />
              </li>
              <li>
                <strong>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.YourRights.Object.Title"
                    fallbackText="Object:"
                  />
                </strong>{" "}
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.YourRights.Object.Description"
                  fallbackText="Object to processing based on legitimate interests"
                />
              </li>
              <li>
                <strong>
                  <TranslatedText
                    ns="legal"
                    translationKey="Privacy.YourRights.WithdrawConsent.Title"
                    fallbackText="Withdraw consent:"
                  />
                </strong>{" "}
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.YourRights.WithdrawConsent.Description"
                  fallbackText="For processing based on consent"
                />
              </li>
            </ul>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.YourRights.Exercise"
                fallbackText="To exercise these rights, contact us at info@ark-fid.ch. We will respond within 30 days."
              />
            </p>
          </div>
        </section>

        {/* International Transfers */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.InternationalTransfers.Title"
              fallbackText="International Data Transfers"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.InternationalTransfers.Description"
                fallbackText="We may transfer personal data outside Switzerland to:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.InternationalTransfers.Destinations.0"
                  fallbackText="EU/EEA countries with adequate data protection"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.InternationalTransfers.Destinations.1"
                  fallbackText="Countries with adequacy decisions from Swiss authorities"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.InternationalTransfers.Destinations.2"
                  fallbackText="Third countries with appropriate safeguards (standard contractual clauses)"
                />
              </li>
            </ul>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.InternationalTransfers.Safeguards"
                fallbackText="All international transfers are conducted with appropriate legal safeguards to ensure your data remains protected to Swiss standards."
              />
            </p>
          </div>
        </section>

        {/* Changes to Policy */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.PolicyChanges.Title"
              fallbackText="Changes to This Policy"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.PolicyChanges.Description"
                fallbackText="We may update this Privacy Policy to reflect changes in our practices, services, or legal requirements. Material changes will be communicated through:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.PolicyChanges.Communication.0"
                  fallbackText="Email notification to registered clients"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.PolicyChanges.Communication.1"
                  fallbackText="Prominent notice on our website"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.PolicyChanges.Communication.2"
                  fallbackText="Direct communication during service interactions"
                />
              </li>
            </ul>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.PolicyChanges.Effectiveness"
                fallbackText="The updated policy will be effective from the date specified in the revised version."
              />
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Privacy.Contact.Title"
              fallbackText="Contact Us"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Privacy.Contact.Description"
                fallbackText="If you have questions about this Privacy Policy or wish to exercise your rights, please contact us:"
              />
            </p>
            <div className="bg-muted/50 p-6 rounded-lg">
              <p className="font-semibold">
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.Contact.CompanyName"
                  fallbackText="Ark Fiduciaire"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.Contact.Email"
                  fallbackText="Email: info@ark-fid.ch"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.Contact.Address"
                  fallbackText="Address: 26 Boulevard Georges Favon, 1204 Geneva"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Privacy.Contact.Phone"
                  fallbackText="Phone: +41 XX XXX XX XX"
                />
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
