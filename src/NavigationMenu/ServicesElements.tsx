import react from "react";
import { Calculator } from "lucide-react";
import {
  Building2,
  MessageSquareReply,
  GitFork,
  FolderCode,
} from "lucide-react";

const services: { title: string; href: string; description: string }[] = [
  {
    icon: <Calculator />,
    title: "Accounting",
    href: "/alert-dialog",
    description:
      "We offer comprehensive accounting services, including bookkeeping, financial reporting, and compliance with Swiss accounting standards. Our team ensures accurate and timely financial management for your business.",
  },
  {
    icon: <FolderCode />,
    title: "Odoo implementation",
    href: "/alert-dialog",
    description:
      "We are official Odoo partners, providing full implementation and configuration services to ensure your Odoo setup meets Swiss accounting standards.",
  },
  {
    icon: <MessageSquareReply />,
    title: "Taxes - Company and Personal",
    href: "/progress",
    description:
      "We handle all aspects of tax compliance, including VAT registration, corporate tax filings, and personal income tax declarations.",
  },
  {
    icon: <Building2 />,
    title: "Company incorporation",
    href: "/hover-card",
    description:
      "We assist with the entire process of company incorporation, including legal documentation, notary services, and registration with the Commercial Register.",
  },
  {
    icon: <GitFork />,
    title: "Payroll & HR",
    href: "/scroll-area",
    description:
      "We manage payroll processing, including salary calculations, payslip generation, and compliance with Swiss social security regulations.",
  },
];

export default services;
