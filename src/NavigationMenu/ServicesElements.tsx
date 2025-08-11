import {
  Calculator,
  Building2,
  MessageSquareReply,
  GitFork,
  FolderCode,
} from "lucide-react";
import Odoo from "@/assets/services/odoo.png";

const services = [
  {
    icon: <Calculator />,
    titleKey: "ServicesElements.Accounting.Title",
    href: "/alert-dialog",
    descriptionKey: "ServicesElements.Accounting.Description",
  },
  {
    icon: <MessageSquareReply />,
    titleKey: "ServicesElements.TaxesCompanyPersonal.Title",
    href: "/progress",
    descriptionKey: "ServicesElements.TaxesCompanyPersonal.Description",
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.PayrollHR.Title",
    href: "/scroll-area",
    descriptionKey: "ServicesElements.PayrollHR.Description",
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.OutsourcingServices.Title",
    href: "/hover-card",
    descriptionKey: "ServicesElements.OutsourcingServices.Description",
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.CorporateServices.Title",
    href: "/hover-card",
    descriptionKey: "ServicesElements.CorporateServices.Description",
  },
  {
    icon: <Building2 />,
    titleKey: "ServicesElements.CompanyIncorporation.Title",
    href: "/hover-card",
    descriptionKey: "ServicesElements.CompanyIncorporation.Description",
  },
  {
    icon: <Building2 />,
    titleKey: "ServicesElements.DomiciliationServices.Title",
    href: "/alert-dialog",
    descriptionKey: "ServicesElements.DomiciliationServices.Description",
  },
  {
    icon: <FolderCode />,
    titleKey: "ServicesElements.OdooImplementation.Title",
    href: "/alert-dialog",
    descriptionKey: "ServicesElements.OdooImplementation.Description",
    image: Odoo,
  },
];

export default services;
