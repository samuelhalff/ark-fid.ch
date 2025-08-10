import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { PlusIcon } from "lucide-react";

const faq = Of course. Here is the updated faq array, which now includes a question about your swissdec-compliant payroll services.

code
JavaScript
download
content_copy
expand_less

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
    question: "How does your collaboration work if we use Odoo for our accounting?",
    answer:
      "You maintain full ownership and control of your data with your own Odoo account. As official Odoo partners, we connect to your system to provide support. This setup allows you to oversee all operations while we assist with the tasks you delegate to us, ensuring a transparent and collaborative partnership."
  },
  {
    question: "Can we delegate specific accounting tasks while handling others ourselves?",
    answer:
      "Absolutely. Our Odoo-based service model is designed for flexibility. You can manage tasks like invoicing and expense tracking yourself, while delegating more complex work like financial closing and tax declarations to us. You control how much work is delegated."
  },
  {
    question: "Do you help with setting up Odoo for accounting and payroll?",
    answer:
      "Yes, as official Odoo partners, we provide complete implementation and configuration services. We ensure your Odoo setup meets Swiss accounting standards and that the payroll module is fully compliant with swissdec, providing a seamless and efficient system."
  },
  {
    question: "How do you manage swissdec-compliant payroll and insurance?",
    answer:
      "We handle all aspects of payroll management through our swissdec-certified Odoo platform. This includes processing monthly salaries, generating payslips, and managing all electronic data transmissions for social security (AHV/AVS), pension funds (BVG/LPP), and withholding tax. We also manage all communications with insurance providers, including employee registrations, mutations, and annual declarations, to ensure you remain fully compliant."
  },
  {
    question: "How much does it cost to set up a Sole Proprietorship?",
    answer:
      "Our fixed fee for establishing a Sole Proprietorship is CHF 690. This package includes the preparation of all required legal documents, notary fees, and our coordination to ensure a smooth registration process. Please note, this does not cover the Commercial Register fee."
  },
  {
    question: "What is the fee for incorporating a Limited Liability Company (GmbH/Sàrl)?",
    answer:
      "Our fixed fee for a Limited Liability Company (GmbH/Sàrl) is CHF 990. This includes drafting the necessary documents, all notary fees, and our full coordination service. The Commercial Register fee is not included in this price."
  },
  {
    question: "What is the cost to form a Corporation (AG/SA)?",
    answer:
      "The all-inclusive fee for forming a Corporation (AG/SA) is CHF 1,090. This covers the creation of corporate documents, notary public fees, and our complete coordination service from start to finish. This fee is exclusive of the mandatory Commercial Register fee."
  },
  {
    question: "Do you offer other services for company formation?",
    answer:
      "Yes, we also provide personalized assistance with opening Swiss corporate bank accounts, drafting bespoke articles of association, and preparing other specific corporate documents. These services are billed on a time basis, with rates ranging from CHF 175 to CHF 350 per hour depending on the complexity of the service."
  }
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
