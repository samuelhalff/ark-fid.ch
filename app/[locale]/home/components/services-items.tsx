import {
  Calculator,
  Building2,
  MessageSquareReply,
  GitFork,
  FolderCode,
} from "lucide-react";

const services = [
  {
    icon: <Calculator />,
    titleKey: "Accounting.Title",
    href: "/accounting",
    descriptionKey: "Accounting.Description",
    image: "/assets/services/accounting-services.png",
  },
  {
    icon: <MessageSquareReply />,
    titleKey: "TaxesCompanyPersonal.Title",
    href: "/taxes",
    descriptionKey: "TaxesCompanyPersonal.Description",
    image: "/assets/services/tax-admin.png",
  },
  {
    icon: <GitFork />,
    titleKey: "PayrollHR.Title",
    href: "/payroll",
    descriptionKey: "PayrollHR.Description",
    image: "/assets/services/hr-services.png",
  },
  {
    icon: <GitFork />,
    titleKey: "OutsourcingServices.Title",
    href: "/outsourcing",
    descriptionKey: "OutsourcingServices.Description",
    image: "/assets/services/outsourcing.png",
  },
  {
    icon: <GitFork />,
    titleKey: "CorporateServices.Title",
    href: "/corporate",
    descriptionKey: "CorporateServices.Description",
    image: "/assets/services/corporate-services.png",
  },
  {
    icon: <Building2 />,
    titleKey: "DomiciliationServices.Title",
    href: "/domiciliation",
    descriptionKey: "DomiciliationServices.Description",
    image: "/assets/services/domiciliation.png",
  },
  {
    icon: <FolderCode />,
    titleKey: "OdooImplementation.Title",
    href: "/odoo",
    descriptionKey: "OdooImplementation.Description",
    image: "/assets/services/odoo-services.png",
  },
];

export default services;
