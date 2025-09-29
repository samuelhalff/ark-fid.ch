"use client";

import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";

const About = () => {
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center">
      <div className="w-full max-w-[1200px]">
        <h2 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight mb-8 text-center">
          <TranslatedText
            ns="home"
            translationKey="About.Title"
            fallbackText="Why Choose Ark Fiduciaire?"
          />
        </h2>

        <div className="text-left w-full space-y-8">
          <TranslatedTextArray
            ns="home"
            translationKey="About.Content"
            fallbackText={[
              "With over a decade of experience in Swiss fiduciary services, Ark Fiduciaire has established itself as a trusted partner for businesses and individuals seeking professional financial and administrative support. Our team of certified accountants, tax specialists, and business consultants combines deep local expertise with international perspectives to deliver comprehensive solutions tailored to the unique needs of the Swiss market.",
              "We understand that every client has different requirements, which is why we offer flexible, personalized services that adapt to your business lifecycle. Whether you're starting a new venture, managing growth, or planning for the future, our fiduciary expertise ensures compliance, optimizes tax efficiency, and provides strategic financial guidance.",
              "Our commitment to excellence is reflected in our rigorous quality standards, continuous professional development, and use of cutting-edge technology. We leverage AI-powered tools and modern ERP systems like Odoo to streamline processes, reduce costs, and provide real-time insights into your financial health.",
              "Located in the heart of French-speaking Switzerland, we serve clients across Geneva, Lausanne, and the broader Romandie region, while maintaining the capability to support international business interests. Our multilingual team communicates fluently in French, English, German, Spanish, and Portuguese, ensuring seamless service delivery for diverse client bases.",
              "Choose Ark Fiduciaire for fiduciary services that combine Swiss precision, innovative technology, and personalized attention. Let us handle the complexities of accounting, taxation, and corporate administration so you can focus on growing your business with confidence.",
            ]}
          />

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">
                <TranslatedText
                  ns="home"
                  translationKey="About.Quality.Title"
                  fallbackText="Swiss Quality Standards"
                />
              </h3>
              <TranslatedText
                ns="home"
                translationKey="About.Quality.Content"
                fallbackText="We adhere to the highest professional standards, including Swiss GAAP accounting principles, tax compliance regulations, and fiduciary best practices. Our certifications and ongoing training ensure that your financial matters are handled with the precision and reliability that Swiss clients expect."
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">
                <TranslatedText
                  ns="home"
                  translationKey="About.Innovation.Title"
                  fallbackText="Technology-Driven Solutions"
                />
              </h3>
              <TranslatedText
                ns="home"
                translationKey="About.Innovation.Content"
                fallbackText="Our integration of AI tools and modern ERP systems allows us to provide faster, more accurate services while maintaining the personal touch that fiduciary relationships require. Experience the future of Swiss fiduciary services with Ark Fiduciaire."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
