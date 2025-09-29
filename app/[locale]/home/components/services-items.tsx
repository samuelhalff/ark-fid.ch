// Inline minimal icons to avoid pulling lucide-react into shared chunk

const Calculator = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M7 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H7zM6 6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6zm1 1h4v2H7V7zm6 0h4v2h-4V7zM7 10h4v2H7v-2zm6 0h4v2h-4v-2zM7 13h4v2H7v-2zm6 0h4v6h-4v-6zM7 16h4v2H7v-2z" />
  </svg>
);

const MessageSquareReply = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M21 6H9a1 1 0 0 0-1 1v8c0 .6.4 1 1 1h9l3 3V7c0-.6-.4-1-1-1zm-3 4H12a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1zm-6-2h6a.5.5 0 0 0 0-1H12a.5.5 0 0 0 0 1zM3 12h2v2H3v3a2 2 0 0 0 2 2h2v2l3-3h4a2 2 0 0 0 2-2H5a2 2 0 0 1-2-2V12z" />
  </svg>
);

const Users = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 8.5a2.5 2.5 0 1 0-5 0m5 0a2.5 2.5 0 1 1-5 0m5 0V21a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-.5" />
  </svg>
);

const Building2 = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM2 14v6a2 2 0 0 0 2 2h2V12H4a2 2 0 0 0-2 2zm18-2v8a2 2 0 0 1-2 2h-2v-8h2a2 2 0 0 1 2 0zM10 6h4m-4 4h4m-4 4h4" />
  </svg>
);

const Briefcase = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M8 7V5a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v2h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h4zm2-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2h-4V5z" />
  </svg>
);

const Layers = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M12.83 2.18l8.96 4.48A1 1 0 0 1 21.32 8L12 12.67 2.68 8a1 1 0 0 1-.47-1.34l8.96-4.48a2 2 0 0 1 1.66 0zm8.96 6.15L12 13l-9.79-4.67c-.11-.05-.22-.08-.33-.08L12 13l10.12-4.75c-.11 0-.22.03-.33.08zm0 4.34L12 17.67l-9.79-4.67c-.11-.05-.22-.08-.33-.08L12 17.67l10.12-4.75c-.11 0-.22.03-.33.08z" />
  </svg>
);

const FolderCode = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M4 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-7L9 2H4zm6.5 11.5l-2 2L8 18l4.5-4.5L8 9 8.5 6.5l2 2zm5 0l2-2L18 9l-4.5 4.5L18 18l-.5 2.5-2-2z" />
  </svg>
);

const Crown = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6"
  >
    <path d="M5 16L3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
  </svg>
);

const services = [
  {
    icon: <Calculator />,
    titleKey: "Accounting.Title",
    href: "/services/accounting",
    descriptionKey: "Accounting.Description",
    image: "/assets/hero/services/accounting-hero.webp",
  },
  {
    icon: <MessageSquareReply />,
    titleKey: "TaxesCompanyPersonal.Title",
    href: "/services/taxes",
    descriptionKey: "TaxesCompanyPersonal.Description",
    image: "/assets/hero/services/taxes-hero.webp",
  },
  {
    icon: <Users />,
    titleKey: "PayrollHR.Title",
    href: "/services/payroll",
    descriptionKey: "PayrollHR.Description",
    image: "/assets/hero/services/payroll-hero.webp",
  },
  {
    icon: <Building2 />,
    titleKey: "Incorporation.Title",
    href: "/services/incorporation",
    descriptionKey: "Incorporation.Description",
    image: "/assets/hero/services/incorporation-hero.webp",
  },
  {
    icon: <Layers />,
    titleKey: "OutsourcingServices.Title",
    href: "/services/outsourcing",
    descriptionKey: "OutsourcingServices.Description",
    image: "/assets/hero/services/outsourcing-hero.webp",
  },
  {
    icon: <Briefcase />,
    titleKey: "CorporateServices.Title",
    href: "/services/corporate",
    descriptionKey: "CorporateServices.Description",
    image: "/assets/hero/services/corporate-hero.webp",
  },
  {
    icon: <Building2 />,
    titleKey: "DomiciliationServices.Title",
    href: "/services/domiciliation",
    descriptionKey: "DomiciliationServices.Description",
    image: "/assets/hero/services/domiciliation-hero.webp",
  },
  {
    icon: <FolderCode />,
    titleKey: "OdooImplementation.Title",
    href: "/services/odoo",
    descriptionKey: "OdooImplementation.Description",
    image: "/assets/hero/services/odoo-hero.webp",
  },
  {
    icon: <Crown />,
    titleKey: "FamilyOffice.Title",
    href: "/services/family-office",
    descriptionKey: "FamilyOffice.Description",
    image: "/assets/hero/services/family-office-hero.webp",
  },
];

export default services;
