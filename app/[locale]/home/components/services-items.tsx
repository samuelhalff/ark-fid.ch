// Use lucide-react icons (tree-shaken) for higher quality, consistent visuals
import {
  Calculator,
  ReceiptText,
  HandCoins,
  FilePlus2,
  Layers,
  Building2,
  Home,
  Puzzle,
  Crown,
} from "lucide-react";

const services = [
  {
    icon: <Calculator className="h-6 w-6" strokeWidth={2} />,
    titleKey: "Accounting.Title",
    href: "/services/accounting",
    descriptionKey: "Accounting.Description",
    image: "/assets/hero/services/accounting-hero.optimized.webp",
  },
  {
    icon: <ReceiptText className="h-6 w-6" strokeWidth={2} />,
    titleKey: "TaxesCompanyPersonal.Title",
    href: "/services/taxes",
    descriptionKey: "TaxesCompanyPersonal.Description",
    image: "/assets/hero/services/taxes-hero.optimized.webp",
  },
  {
    icon: <HandCoins className="h-6 w-6" strokeWidth={2} />,
    titleKey: "PayrollHR.Title",
    href: "/services/payroll",
    descriptionKey: "PayrollHR.Description",
    image: "/assets/hero/services/payroll-hero.optimized.webp",
  },
  {
    icon: <FilePlus2 className="h-6 w-6" strokeWidth={2} />,
    titleKey: "Incorporation.Title",
    href: "/services/incorporation",
    descriptionKey: "Incorporation.Description",
    image: "/assets/hero/services/incorporation-hero.optimized.webp",
  },
  {
    icon: <Layers className="h-6 w-6" strokeWidth={2} />,
    titleKey: "OutsourcingServices.Title",
    href: "/services/outsourcing",
    descriptionKey: "OutsourcingServices.Description",
    image: "/assets/hero/services/outsourcing-hero.optimized.webp",
  },
  {
    icon: <Building2 className="h-6 w-6" strokeWidth={2} />,
    titleKey: "CorporateServices.Title",
    href: "/services/corporate",
    descriptionKey: "CorporateServices.Description",
    image: "/assets/hero/services/corporate-hero.optimized.webp",
  },
  {
    icon: <Home className="h-6 w-6" strokeWidth={2} />,
    titleKey: "DomiciliationServices.Title",
    href: "/services/domiciliation",
    descriptionKey: "DomiciliationServices.Description",
    image: "/assets/hero/services/domiciliation-hero.optimized.webp",
  },
  {
    icon: <Puzzle className="h-6 w-6" strokeWidth={2} />,
    titleKey: "OdooImplementation.Title",
    href: "/services/odoo",
    descriptionKey: "OdooImplementation.Description",
    image: "/assets/hero/services/odoo-hero.optimized.webp",
  },
  {
    icon: <Crown className="h-6 w-6" strokeWidth={2} />,
    titleKey: "FamilyOffice.Title",
    href: "/services/family-office",
    descriptionKey: "FamilyOffice.Description",
    image: "/assets/hero/services/family-office-hero.optimized.webp",
  },
];

export default services;
