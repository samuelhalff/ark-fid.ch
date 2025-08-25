import { type Metadata } from "next";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedDate from "@/src/components/ui/translated-date";
import { Separator } from "@/src/components/ui/separator";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cookies Policy | Ark Fiduciaire",
    description:
      "Cookies Policy for Ark Fiduciaire - Information about our use of cookies and tracking technologies on our website.",
    openGraph: {
      title: "Cookies Policy | Ark Fiduciaire",
      description:
        "Cookies Policy for Ark Fiduciaire - Information about our use of cookies and tracking technologies on our website.",
      type: "website",
    },
  };
}

export default function CookiesPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-[var(--breakpoint-xl)]">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">
          <TranslatedText
            ns="legal"
            translationKey="Cookies.Title"
            fallbackText="Cookies Policy"
          />
        </h1>
        <p className="text-lg text-muted-foreground dark:text-white mb-2">
          <TranslatedText
            ns="legal"
            translationKey="Cookies.Subtitle"
            fallbackText="Information about our use of cookies and tracking technologies"
          />
        </p>
        <p className="text-xs text-muted-foreground dark:text-white">
          <TranslatedText
            ns="legal"
            translationKey="Cookies.LastUpdated"
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
              translationKey="Cookies.Introduction.Title"
              fallbackText="Introduction"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.Introduction.Content.0"
                fallbackText="This Cookies Policy explains how Ark Fiduciaire uses cookies and similar tracking technologies on our website. It provides information about what cookies are, how we use them, and your choices regarding their use."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.Introduction.Content.1"
                fallbackText="By using our website, you consent to the use of cookies in accordance with this policy and our Privacy Policy."
              />
            </p>
          </div>
        </section>

        {/* What Are Cookies */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Cookies.WhatAreCookies.Title"
              fallbackText="What Are Cookies?"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.WhatAreCookies.Description"
                fallbackText="Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit a website. They allow the website to recognize your device and store information about your preferences or past actions."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.WhatAreCookies.CookiesContain"
                fallbackText="Cookies typically contain:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.WhatAreCookies.Contents.0"
                  fallbackText="The name of the server that placed the cookie"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.WhatAreCookies.Contents.1"
                  fallbackText="An identifier in the form of a unique number"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.WhatAreCookies.Contents.2"
                  fallbackText="An expiration date (some cookies only last for the duration of your session)"
                />
              </li>
            </ul>
          </div>
        </section>

        {/* Types of Cookies */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Cookies.Types.Title"
              fallbackText="Types of Cookies We Use"
            />
          </h2>
          <div className="space-y-8">
            {/* Essential Cookies */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Types.Essential.Title"
                  fallbackText="1. Essential Cookies"
                />
              </h3>
              <p className="mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Types.Essential.Description"
                  fallbackText="These cookies are necessary for the website to function properly and cannot be disabled."
                />
              </p>
              <div className="bg-muted/50 p-6 rounded-lg">
                <p className="font-semibold mb-2">
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Types.Essential.Purpose"
                    fallbackText="Purpose:"
                  />
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Essential.Items.0"
                      fallbackText="Website navigation and basic functionality"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Essential.Items.1"
                      fallbackText="Security and authentication"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Essential.Items.2"
                      fallbackText="Language and accessibility preferences"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Essential.Items.3"
                      fallbackText="Form submission and session management"
                    />
                  </li>
                </ul>
                <p className="mt-3 text-sm">
                  <strong>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Essential.LegalBasis"
                      fallbackText="Legal basis: Necessary for service provision"
                    />
                  </strong>
                </p>
              </div>
            </div>

            {/* Analytics Cookies */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Types.Analytics.Title"
                  fallbackText="2. Analytics Cookies"
                />
              </h3>
              <p className="mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Types.Analytics.Description"
                  fallbackText="These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously."
                />
              </p>
              <div className="bg-muted/50 p-6 rounded-lg">
                <p className="font-semibold mb-2">
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Types.Analytics.Purpose"
                    fallbackText="Purpose:"
                  />
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Analytics.Items.0"
                      fallbackText="Website traffic analysis"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Analytics.Items.1"
                      fallbackText="Page performance monitoring"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Analytics.Items.2"
                      fallbackText="User behavior patterns"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Analytics.Items.3"
                      fallbackText="Website optimization and improvement"
                    />
                  </li>
                </ul>
                <p className="mt-3 text-sm">
                  <strong>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Analytics.LegalBasis"
                      fallbackText="Legal basis: Legitimate interests / Consent (where required)"
                    />
                  </strong>
                </p>
                <p className="mt-2 text-sm">
                  <strong>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Analytics.Providers"
                      fallbackText="Providers: Google Analytics, internal analytics tools"
                    />
                  </strong>
                </p>
              </div>
            </div>

            {/* Functional Cookies */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Types.Functional.Title"
                  fallbackText="3. Functional Cookies"
                />
              </h3>
              <p className="mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Types.Functional.Description"
                  fallbackText="These cookies enable enhanced functionality and personalization features."
                />
              </p>
              <div className="bg-muted/50 p-6 rounded-lg">
                <p className="font-semibold mb-2">
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Types.Functional.Purpose"
                    fallbackText="Purpose:"
                  />
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Functional.Items.0"
                      fallbackText="Remembering language and theme preferences"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Functional.Items.1"
                      fallbackText="Saving form data and progress"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Functional.Items.2"
                      fallbackText="Customizing content and layout"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Functional.Items.3"
                      fallbackText="Providing live chat functionality"
                    />
                  </li>
                </ul>
                <p className="mt-3 text-sm">
                  <strong>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Functional.LegalBasis"
                      fallbackText="Legal basis: Legitimate interests / Consent"
                    />
                  </strong>
                </p>
              </div>
            </div>

            {/* Marketing Cookies */}
            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Types.Marketing.Title"
                  fallbackText="4. Marketing Cookies"
                />
              </h3>
              <p className="mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Types.Marketing.Description"
                  fallbackText="These cookies track visitors across websites to display relevant and engaging advertisements."
                />
              </p>
              <div className="bg-muted/50 p-6 rounded-lg">
                <p className="font-semibold mb-2">
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Types.Marketing.Purpose"
                    fallbackText="Purpose:"
                  />
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Marketing.Items.0"
                      fallbackText="Targeted advertising"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Marketing.Items.1"
                      fallbackText="Measuring ad effectiveness"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Marketing.Items.2"
                      fallbackText="Retargeting campaigns"
                    />
                  </li>
                  <li>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Marketing.Items.3"
                      fallbackText="Social media integration"
                    />
                  </li>
                </ul>
                <p className="mt-3 text-sm">
                  <strong>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Marketing.LegalBasis"
                      fallbackText="Legal basis: Consent"
                    />
                  </strong>
                </p>
                <p className="mt-2 text-sm">
                  <strong>
                    <TranslatedText
                      ns="legal"
                      translationKey="Cookies.Types.Marketing.Providers"
                      fallbackText="Providers: Google Ads, LinkedIn, Facebook"
                    />
                  </strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Third-Party Cookies */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Cookies.ThirdParty.Title"
              fallbackText="Third-Party Cookies"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.ThirdParty.Description"
                fallbackText="Our website may include content or services from third parties that set their own cookies. These include:"
              />
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.TableHeaders.Provider"
                        fallbackText="Provider"
                      />
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.TableHeaders.Purpose"
                        fallbackText="Purpose"
                      />
                    </th>
                    <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.TableHeaders.PrivacyPolicy"
                        fallbackText="Privacy Policy"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.Providers.GoogleAnalytics"
                        fallbackText="Google Analytics"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.Purposes.Analytics"
                        fallbackText="Website analytics and performance"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <a
                        href="https://policies.google.com/privacy"
                        className="text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google Privacy Policy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.Providers.GoogleMaps"
                        fallbackText="Google Maps"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.Purposes.Maps"
                        fallbackText="Location services and maps"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <a
                        href="https://policies.google.com/privacy"
                        className="text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google Privacy Policy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.Providers.LinkedIn"
                        fallbackText="LinkedIn"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <TranslatedText
                        ns="legal"
                        translationKey="Cookies.ThirdParty.Purposes.Professional"
                        fallbackText="Professional networking and advertising"
                      />
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                      <a
                        href="https://www.linkedin.com/legal/privacy-policy"
                        className="text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        LinkedIn Privacy Policy
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Cookie Duration */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Cookies.Duration.Title"
              fallbackText="Cookie Duration"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.Duration.Description"
                fallbackText="Cookies are classified by duration as follows:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Duration.Types.0"
                  fallbackText="Session Cookies: Temporary cookies that are deleted when you close your browser"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Duration.Types.1"
                  fallbackText="Persistent Cookies: Remain on your device for a set period or until manually deleted"
                />
              </li>
            </ul>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Duration.Lifespans.Title"
                  fallbackText="Typical Cookie Lifespans:"
                />
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Duration.Lifespans.Items.0"
                    fallbackText="Essential cookies: Session duration or up to 1 year"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Duration.Lifespans.Items.1"
                    fallbackText="Analytics cookies: 2 years maximum"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Duration.Lifespans.Items.2"
                    fallbackText="Functional cookies: 1 year maximum"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Duration.Lifespans.Items.3"
                    fallbackText="Marketing cookies: 30 days to 2 years"
                  />
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Managing Cookies */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Cookies.Management.Title"
              fallbackText="Managing Your Cookie Preferences"
            />
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Management.ConsentBanner.Title"
                  fallbackText="Cookie Consent Banner"
                />
              </h3>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Management.ConsentBanner.Description"
                  fallbackText="When you first visit our website, you'll see a cookie consent banner allowing you to:"
                />
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.ConsentBanner.Options.0"
                    fallbackText="Accept all cookies"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.ConsentBanner.Options.1"
                    fallbackText="Reject non-essential cookies"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.ConsentBanner.Options.2"
                    fallbackText="Customize your preferences by cookie category"
                  />
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Management.BrowserSettings.Title"
                  fallbackText="Browser Settings"
                />
              </h3>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Management.BrowserSettings.Description"
                  fallbackText="You can also control cookies through your browser settings. Most browsers allow you to:"
                />
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.BrowserSettings.Options.0"
                    fallbackText="View and delete cookies"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.BrowserSettings.Options.1"
                    fallbackText="Block cookies from specific websites"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.BrowserSettings.Options.2"
                    fallbackText="Block third-party cookies"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.BrowserSettings.Options.3"
                    fallbackText="Clear all cookies when you close the browser"
                  />
                </li>
              </ul>

              <div className="mt-4">
                <p className="font-semibold mb-2">
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.BrowserSettings.Instructions"
                    fallbackText="Browser-specific instructions:"
                  />
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <a
                      href="https://support.google.com/chrome/answer/95647"
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Chrome
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Firefox
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac"
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Safari
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://support.microsoft.com/en-us/help/17442/windows-internet-explorer-delete-manage-cookies"
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Internet Explorer
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Management.DisablingImpact.Title"
                  fallbackText="Impact of Disabling Cookies"
                />
              </h3>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Management.DisablingImpact.Description"
                  fallbackText="Please note that disabling certain cookies may affect your experience on our website:"
                />
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.DisablingImpact.Effects.0"
                    fallbackText="Essential cookies: Website may not function properly"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.DisablingImpact.Effects.1"
                    fallbackText="Analytics cookies: We cannot improve our website based on usage data"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.DisablingImpact.Effects.2"
                    fallbackText="Functional cookies: Personalization features will be disabled"
                  />
                </li>
                <li>
                  <TranslatedText
                    ns="legal"
                    translationKey="Cookies.Management.DisablingImpact.Effects.3"
                    fallbackText="Marketing cookies: You may see less relevant advertisements"
                  />
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Do Not Track */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Cookies.DoNotTrack.Title"
              fallbackText="Do Not Track Signals"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.DoNotTrack.Description"
                fallbackText="Some browsers include a 'Do Not Track' feature that lets you tell websites you do not want to be tracked. Currently, there is no accepted standard for how websites should respond to Do Not Track signals."
              />
            </p>
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.DoNotTrack.Response"
                fallbackText="We respect your privacy choices and are monitoring developments in this area to implement appropriate responses to Do Not Track signals when industry standards are established."
              />
            </p>
          </div>
        </section>

        {/* Updates to Policy */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Cookies.Updates.Title"
              fallbackText="Updates to This Policy"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.Updates.Description"
                fallbackText="We may update this Cookies Policy from time to time to reflect changes in technology, law, or our practices. When we make significant changes, we will:"
              />
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Updates.Actions.0"
                  fallbackText="Update the 'Last Updated' date at the top of this page"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Updates.Actions.1"
                  fallbackText="Notify users through our website banner or email (for significant changes)"
                />
              </li>
              <li>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Updates.Actions.2"
                  fallbackText="Request renewed consent where required by law"
                />
              </li>
            </ul>
          </div>
        </section>

        {/* Contact Information */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            <TranslatedText
              ns="legal"
              translationKey="Cookies.Contact.Title"
              fallbackText="Contact Us"
            />
          </h2>
          <div className="space-y-4">
            <p>
              <TranslatedText
                ns="legal"
                translationKey="Cookies.Contact.Description"
                fallbackText="If you have any questions about this Cookies Policy or our use of cookies, please contact us:"
              />
            </p>
            <div className="bg-muted/50 p-6 rounded-lg">
              <p className="font-semibold">
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Contact.CompanyName"
                  fallbackText="Ark Fiduciaire"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Contact.Email"
                  fallbackText="Email: info@ark-fid.ch"
                />
              </p>
              <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Contact.Address"
                  fallbackText="Address: 26 Boulevard Georges Favon, 1204 Geneva"
                />
              </p>
              {/* <p>
                <TranslatedText
                  ns="legal"
                  translationKey="Cookies.Contact.Phone"
                  fallbackText="Phone: +41 XX XXX XX XX"
                />
              </p> */}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
