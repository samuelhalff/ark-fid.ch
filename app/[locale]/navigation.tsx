// Service navigation items for the NavMenu
import {
  Briefcase,
  FileText,
  Users,
  Building2,
  Settings,
  Landmark,
} from "lucide-react";

const ServicesElements = [
  {
    titleKey: "Accounting.Title",
    descriptionKey: "Accounting.Description",
    href: "/services/accounting",
    icon: <FileText className="text-primary" size={20} />,
  },
  {
    titleKey: "TaxesCompanyPersonal.Title",
    descriptionKey: "TaxesCompanyPersonal.Description",
    href: "/services/taxes",
    icon: <Landmark className="text-primary" size={20} />,
  },
  {
    titleKey: "PayrollHR.Title",
    descriptionKey: "PayrollHR.Description",
    href: "/services/payroll",
    icon: <Users className="text-primary" size={20} />,
  },
  {
    titleKey: "OutsourcingServices.Title",
    descriptionKey: "OutsourcingServices.Description",
    href: "/services/outsourcing",
    icon: <Briefcase className="text-primary" size={20} />,
  },
  {
    titleKey: "CorporateServices.Title",
    descriptionKey: "CorporateServices.Description",
    href: "/services/corporate",
    icon: <Building2 className="text-primary" size={20} />,
  },
  {
    titleKey: "OdooImplementation.Title",
    descriptionKey: "OdooImplementation.Description",
    href: "/services/odoo",
    icon: <Settings className="text-primary" size={20} />,
  },
  {
    titleKey: "DomiciliationServices.Title",
    descriptionKey: "DomiciliationServices.Description",
    href: "/services/domiciliation",
    icon: <Building2 className="text-primary" size={20} />,
  },
];

export default ServicesElements;
