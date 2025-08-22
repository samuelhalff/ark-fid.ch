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
    titleKey: "ServicesElements.Accounting.Title",
    href: "/accounting",
    descriptionKey: "ServicesElements.Accounting.Description",
    image: "/assets/services/accounting-services.png",
  },
  {
    icon: <MessageSquareReply />,
    titleKey: "ServicesElements.TaxesCompanyPersonal.Title",
    href: "/taxes",
    descriptionKey: "ServicesElements.TaxesCompanyPersonal.Description",
    image: "/assets/services/tax-admin.png",
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.PayrollHR.Title",
    href: "/payroll",
    descriptionKey: "ServicesElements.PayrollHR.Description",
    image: "/assets/services/hr-services.png",
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.OutsourcingServices.Title",
    href: "/outsourcing",
    descriptionKey: "ServicesElements.OutsourcingServices.Description",
    image: "/assets/services/outsourcing.png",
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.CorporateServices.Title",
    href: "/corporate",
    descriptionKey: "ServicesElements.CorporateServices.Description",
    image: "/assets/services/corporate-services.png",
  },
  {
    icon: <Building2 />,
    titleKey: "ServicesElements.DomiciliationServices.Title",
    href: "/domiciliation",
    descriptionKey: "ServicesElements.DomiciliationServices.Description",
    image: "/assets/services/domiciliation.png",
  },
  {
    icon: <FolderCode />,
    titleKey: "ServicesElements.OdooImplementation.Title",
    href: "/odoo",
    descriptionKey: "ServicesElements.OdooImplementation.Description",
    image: "/assets/services/odoo-services.png",
  },
];

export default services;
