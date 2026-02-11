// Service navigation items for the NavMenu
// Inline SVG icons to eliminate lucide-react from critical path bundle
const FileTextIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);
const LandmarkIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="22" x2="21" y2="22" />
    <line x1="6" y1="18" x2="6" y2="11" />
    <line x1="10" y1="18" x2="10" y2="11" />
    <line x1="14" y1="18" x2="14" y2="11" />
    <line x1="18" y1="18" x2="18" y2="11" />
    <polygon points="12 2 20 7 4 7" />
  </svg>
);
const UsersIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const BriefcaseIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const Building2Icon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </svg>
);
const PinIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);
const PlaneIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 16l20-6-20-6 5 6-5 6z" />
    <path d="M7 10h7" />
  </svg>
);
const SettingsIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const CrownIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);
const HandshakeIcon = () => (
  <svg
    className="text-primary"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 8 9 4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 0 2.8 0L17 4a2 2 0 0 1 2.8 0L21 5.2" />
    <path d="m3 7 2 2.5a2 2 0 0 1 .4 1.2V16a3 3 0 0 0 3 3h.5" />
    <path d="m21 7-2 2.5a2 2 0 0 0-.4 1.2v5a3 3 0 0 1-3 3h-.5" />
    <path d="M9.5 21 8 19.5a1 1 0 0 1 1.4-1.4l1.8 1.8" />
    <path d="m13.5 21 3-3a1 1 0 0 0-1.4-1.4L13 18.8" />
    <path d="M14 16 9.5 11.5" />
    <path d="M11 16 8.5 13.5a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 1.4 0L14 15" />
  </svg>
);

const ServicesElements = [
  {
    titleKey: "Accounting.Title",
    descriptionKey: "Accounting.Description",
    href: "/services/accounting/",
    icon: <FileTextIcon />,
  },
  {
    titleKey: "TaxesCompanyPersonal.Title",
    descriptionKey: "TaxesCompanyPersonal.Description",
    href: "/services/taxes/",
    icon: <LandmarkIcon />,
  },
  {
    titleKey: "PayrollHR.Title",
    descriptionKey: "PayrollHR.Description",
    href: "/services/payroll/",
    icon: <UsersIcon />,
  },
  {
    titleKey: "OutsourcingServices.Title",
    descriptionKey: "OutsourcingServices.Description",
    href: "/services/outsourcing/",
    icon: <BriefcaseIcon />,
  },
  {
    titleKey: "MAServices.Title",
    descriptionKey: "MAServices.Description",
    href: "/services/mergers-acquisitions/",
    icon: <HandshakeIcon />,
  },
  {
    titleKey: "CorporateServices.Title",
    descriptionKey: "CorporateServices.Description",
    href: "/services/corporate/",
    icon: <Building2Icon />,
  },
  {
    titleKey: "Incorporation.Title",
    descriptionKey: "Incorporation.Description",
    href: "/services/incorporation/",
    icon: <Building2Icon />,
  },
  {
    titleKey: "ImmigrationServices.Title",
    descriptionKey: "ImmigrationServices.Description",
    href: "/services/immigration/",
    icon: <PlaneIcon />,
  },
  {
    titleKey: "OdooImplementation.Title",
    descriptionKey: "OdooImplementation.Description",
    href: "/services/odoo/",
    icon: <SettingsIcon />,
  },
  {
    titleKey: "DomiciliationServices.Title",
    descriptionKey: "DomiciliationServices.Description",
    href: "/services/domiciliation/",
    icon: <PinIcon />,
  },
  {
    titleKey: "FamilyOffice.Title",
    descriptionKey: "FamilyOffice.Description",
    href: "/services/family-office/",
    icon: <CrownIcon />,
  },
];

export default ServicesElements;
