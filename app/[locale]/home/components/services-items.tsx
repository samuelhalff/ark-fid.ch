import {
  Calculator,
  Building2,
  MessageSquareReply,
  Users,
  Briefcase,
  Layers,
  FolderCode,
} from "lucide-react";

const services = [
  {
    icon: <Calculator />,
    titleKey: "Accounting.Title",
    href: "/accounting",
    descriptionKey: "Accounting.Description",
    image: "/assets/services/accounting-services.webp",
  },
  {
    icon: <MessageSquareReply />,
    titleKey: "TaxesCompanyPersonal.Title",
    href: "/taxes",
    descriptionKey: "TaxesCompanyPersonal.Description",
    image: "/assets/services/tax-admin.webp",
  },
  {
    icon: <Users />,
    titleKey: "PayrollHR.Title",
    href: "/payroll",
    descriptionKey: "PayrollHR.Description",
    image: "/assets/services/hr-services.webp",
  },
  {
    icon: <Building2 />,
    titleKey: "IncorporationServices.Title",
    href: "/incorporation",
    descriptionKey: "IncorporationServices.Description",
    image: "/assets/services/tax-desk.webp",
  },
  {
    icon: <Layers />,
    titleKey: "OutsourcingServices.Title",
    href: "/outsourcing",
    descriptionKey: "OutsourcingServices.Description",
    image: "/assets/services/outsourcing.webp",
  },
  {
    icon: <Briefcase />,
    titleKey: "CorporateServices.Title",
    href: "/corporate",
    descriptionKey: "CorporateServices.Description",
    image: "/assets/services/corporate-services.webp",
  },
  {
    icon: <Building2 />,
    titleKey: "DomiciliationServices.Title",
    href: "/domiciliation",
    descriptionKey: "DomiciliationServices.Description",
    image: "/assets/services/domiciliation.webp",
  },
  {
    icon: <FolderCode />,
    titleKey: "OdooImplementation.Title",
    href: "/odoo",
    descriptionKey: "OdooImplementation.Description",
    image: "/assets/services/odoo-services.webp",
  },
];

export default services;
