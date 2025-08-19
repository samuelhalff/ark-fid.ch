import {
  Calculator,
  Building2,
  MessageSquareReply,
  GitFork,
  FolderCode,
} from "lucide-react";

import Mountains from "@/assets/services/mountain-river.png";
import Accounting from "@/assets/services/accounting-services.png";
import TaxAdministration from "@/assets/services/tax-admin.png";
import HRServices from "@/assets/services/hr-services.png";
import Outsourcing from "@/assets/services/outsourcing.png";
import Domiciliation from "@/assets/services/domiciliation.png";
import CorporateServices from "@/assets/services/corporate-services.png";
import OdooServices from "@/assets/services/odoo-services.png";

const services = [
  {
    icon: <Calculator />,
    titleKey: "ServicesElements.Accounting.Title",
    href: "/accounting",
    descriptionKey: "ServicesElements.Accounting.Description",
    image: Accounting,
  },
  {
    icon: <MessageSquareReply />,
    titleKey: "ServicesElements.TaxesCompanyPersonal.Title",
    href: "/taxes",
    descriptionKey: "ServicesElements.TaxesCompanyPersonal.Description",
    image: TaxAdministration,
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.PayrollHR.Title",
    href: "/payroll",
    descriptionKey: "ServicesElements.PayrollHR.Description",
    image: HRServices,
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.OutsourcingServices.Title",
    href: "/outsourcing",
    descriptionKey: "ServicesElements.OutsourcingServices.Description",
    image: Outsourcing,
  },
  {
    icon: <GitFork />,
    titleKey: "ServicesElements.CorporateServices.Title",
    href: "/corporate",
    descriptionKey: "ServicesElements.CorporateServices.Description",
    image: CorporateServices,
  },
  {
    icon: <Building2 />,
    titleKey: "ServicesElements.DomiciliationServices.Title",
    href: "/domiciliation",
    descriptionKey: "ServicesElements.DomiciliationServices.Description",
    image: Domiciliation,
  },
  {
    icon: <FolderCode />,
    titleKey: "ServicesElements.OdooImplementation.Title",
    href: "/odoo",
    descriptionKey: "ServicesElements.OdooImplementation.Description",
    image: OdooServices,
  },
];

export default services;
