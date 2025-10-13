// Outline icons sized to read well inside a 56–64px chip
const calcClass = "h-6 w-6 sm:h-7 sm:w-7";
const Calculator = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8M8 11h3M13 11h3M8 15h3M13 15h3" />
  </svg>
);

const MessageSquareReply = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 7a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7l4 3V7z" />
    <path d="M7 12h7M7 9h10" />
  </svg>
);

const Users = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.8" />
    <path d="M16 3.2a4 4 0 0 1 0 7.6" />
  </svg>
);

const Building2 = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="6" y="3" width="12" height="18" rx="2" />
    <path d="M10 7h4M10 11h4M10 15h4" />
    <path d="M3 12h3v9H5a2 2 0 0 1-2-2zM21 12h-3v9h1a2 2 0 0 0 2-2z" />
  </svg>
);

const Briefcase = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <path d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1M3 12h18" />
  </svg>
);

const Layers = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 4l8 4-8 4-8-4 8-4z" />
    <path d="M4 12l8 4 8-4" />
    <path d="M4 16l8 4 8-4" />
  </svg>
);

// Minimal settings/integration icon for Odoo — cleaner than folder/code
const CogSimple = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M18.9 5.1l-2.1 2.1M5.1 18.9l2.1-2.1" />
  </svg>
);

// Map pin to differentiate from incorporation building icon
const MapPin = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const Crown = () => (
  <svg viewBox="0 0 24 24" className={calcClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10l4 3 5-7 5 7 4-3v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const services = [
  {
    icon: <Calculator />,
    titleKey: "Accounting.Title",
    href: "/services/accounting",
    descriptionKey: "Accounting.Description",
    image: "/assets/hero/services/accounting-hero.optimized.webp",
  },
  {
    icon: <MessageSquareReply />,
    titleKey: "TaxesCompanyPersonal.Title",
    href: "/services/taxes",
    descriptionKey: "TaxesCompanyPersonal.Description",
    image: "/assets/hero/services/taxes-hero.optimized.webp",
  },
  {
    icon: <Users />,
    titleKey: "PayrollHR.Title",
    href: "/services/payroll",
    descriptionKey: "PayrollHR.Description",
    image: "/assets/hero/services/payroll-hero.optimized.webp",
  },
  {
    icon: <Building2 />,
    titleKey: "Incorporation.Title",
    href: "/services/incorporation",
    descriptionKey: "Incorporation.Description",
    image: "/assets/hero/services/home-hero.avif",
  },
  {
    icon: <Layers />,
    titleKey: "OutsourcingServices.Title",
    href: "/services/outsourcing",
    descriptionKey: "OutsourcingServices.Description",
    image: "/assets/hero/services/outsourcing-hero.optimized.webp",
  },
  {
    icon: <Briefcase />,
    titleKey: "CorporateServices.Title",
    href: "/services/corporate",
    descriptionKey: "CorporateServices.Description",
    image: "/assets/hero/services/corporate-hero.optimized.webp",
  },
  {
    icon: <MapPin />,
    titleKey: "DomiciliationServices.Title",
    href: "/services/domiciliation",
    descriptionKey: "DomiciliationServices.Description",
    image: "/assets/hero/services/domiciliation-hero.optimized.webp",
  },
  {
    icon: <CogSimple />,
    titleKey: "OdooImplementation.Title",
    href: "/services/odoo",
    descriptionKey: "OdooImplementation.Description",
    image: "/assets/hero/services/odoo-hero.optimized.webp",
  },
  {
    icon: <Crown />,
    titleKey: "FamilyOffice.Title",
    href: "/services/family-office",
    descriptionKey: "FamilyOffice.Description",
    image: "/assets/hero/services/family-office-hero.optimized.webp",
  },
];

export default services;
