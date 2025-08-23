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
    titleKey: "ServicesElements.Accounting.Title",
    descriptionKey: "ServicesElements.Accounting.Description",
    href: "/services/accounting",
    icon: <FileText className="text-primary" size={20} />,
  },
  {
    titleKey: "ServicesElements.TaxesCompanyPersonal.Title",
    descriptionKey: "ServicesElements.TaxesCompanyPersonal.Description",
    href: "/services/taxes",
    icon: <Landmark className="text-primary" size={20} />,
  },
  {
    titleKey: "ServicesElements.PayrollHR.Title",
    descriptionKey: "ServicesElements.PayrollHR.Description",
    href: "/services/payroll",
    icon: <Users className="text-primary" size={20} />,
  },
  {
    titleKey: "ServicesElements.OutsourcingServices.Title",
    descriptionKey: "ServicesElements.OutsourcingServices.Description",
    href: "/services/outsourcing",
    icon: <Briefcase className="text-primary" size={20} />,
  },
  {
    titleKey: "ServicesElements.CorporateServices.Title",
    descriptionKey: "ServicesElements.CorporateServices.Description",
    href: "/services/corporate",
    icon: <Building2 className="text-primary" size={20} />,
  },
  {
    titleKey: "ServicesElements.OdooImplementation.Title",
    descriptionKey: "ServicesElements.OdooImplementation.Description",
    href: "/services/odoo",
    icon: <Settings className="text-primary" size={20} />,
  },
  {
    titleKey: "ServicesElements.DomiciliationServices.Title",
    descriptionKey: "ServicesElements.DomiciliationServices.Description",
    href: "/services/domiciliation",
    icon: <Building2 className="text-primary" size={20} />,
  },
];

export default ServicesElements;
