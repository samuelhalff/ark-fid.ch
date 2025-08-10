import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { PlusIcon } from "lucide-react";

const faq = [
  {
    question: "Who needs accounting services in Switzerland?",
    answer:
      "Any company operating in Switzerland, from startups to large enterprises, requires accounting services to ensure compliance with local tax and financial laws.",
  },
  {
    question: "What services do accountants in Switzerland offer?",
    answer:
      "Accountants in Switzerland offer a range of services, including bookkeeping, preparing financial statements, tax planning and filing, VAT services, payroll, HR and contract support, and audit assistance.",
  },
  {
    question: "Is VAT registration mandatory in Switzerland?",
    answer:
      "Yes, if your company's annual turnover exceeds CHF 100,000, you must register for VAT.",
  },
  {
    question: "What are the corporate tax rates in Switzerland?",
    answer:
      "The corporate tax rates in Switzerland vary by canton and municipality, with effective rates typically ranging from 11.9% to 21.6%. The federal corporate income tax rate is 8.5% on net profit.",
  },
  {
    question: "What is the difference between capital tax and wealth tax?",
    answer:
      "Capital tax applies to a company's equity, including share capital and retained earnings. Wealth tax is levied on the total value of assets owned by individuals, which affects sole proprietors and individual entrepreneurs.",
  },
  {
    question: "How are foreign companies taxed in Switzerland?",
    answer:
      "Foreign companies are generally subject to limited taxation in Switzerland if they own real estate or have a permanent establishment in the country.",
  },
  {
    question: "What are the main steps to open a Swiss company?",
    answer:
      "The main steps include choosing a suitable business form, selecting a unique company name, opening a Swiss bank account for the share capital deposit, preparing and notarizing the necessary company documents for registration with the Swiss Trade Register, and potentially registering for VAT.",
  },
  {
    question:
      "Is there a minimum share capital required to open a company in Switzerland?",
    answer:
      "Yes, the minimum share capital depends on the business type. A limited liability company (GmbH) requires a deposit of CHF 20,000, while a corporation (AG) requires CHF 100,000 or more. Sole proprietorships do not have a minimum share capital requirement.",
  },
  {
    question: "Can foreigners open a business in Switzerland?",
    answer:
      "Yes, foreign investors and entrepreneurs can open companies in Switzerland and receive the same benefits as local business owners.",
  },
  {
    question: "What HR and payroll services are typically offered?",
    answer:
      "Services typically include gross-to-net salary calculations, handling social security contributions, managing employee onboarding and employment contracts, issuing payslips, and support with work permits for foreign employees.",
  },
];

const FAQ = () => {
  return (
    <div id="faq" className="w-full max-w-screen-xl mx-auto py-8 xs:py-16 px-6">
      <h2 className="md:text-center text-3xl xs:text-4xl md:text-5xl !leading-[1.15] font-bold tracking-tighter">
        Frequently Asked Questions
      </h2>
      <p className="mt-1.5 md:text-center xs:text-lg text-muted-foreground">
        Quick answers to common questions about our products and services.
      </p>

      <div className="min-h-[550px] md:min-h-[320px] xl:min-h-[300px]">
        <Accordion
          type="single"
          collapsible
          className="mt-8 space-y-4 md:columns-2 gap-4"
        >
          {faq.map(({ question, answer }, index) => (
            <AccordionItem
              key={question}
              value={`question-${index}`}
              className="bg-accent py-1 px-4 rounded-xl border-none !mt-0 !mb-4 break-inside-avoid"
            >
              <AccordionPrimitive.Header className="flex">
                <AccordionPrimitive.Trigger
                  className={cn(
                    "flex flex-1 items-center justify-between py-4 font-semibold tracking-tight transition-all hover:underline [&[data-state=open]>svg]:rotate-45",
                    "text-start text-lg"
                  )}
                >
                  {question}
                  <PlusIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent className="text-[15px] text-left text-muted-foreground">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default FAQ;
