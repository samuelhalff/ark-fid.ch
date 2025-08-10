import react from "react";
import { Calculator } from "lucide-react";
import { Building2 } from "lucide-react";

const services: { title: string; href: string; description: string }[] = [
  {
    icon: <Calculator />,
    title: "Accounting",
    href: "/alert-dialog",
    description:
      "A modal dialog that interrupts the user with important content and expects a response.",
  },
  {
    title: "Taxes - Company and Personal",
    href: "/progress",
    description:
      "Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.",
  },
  {
    icon: <Building2 />,
    title: "Company incorporation",
    href: "/hover-card",
    description:
      "For sighted users to preview content available behind a link.",
  },
  {
    title: "Payroll & HR",
    href: "/scroll-area",
    description: "Visually or semantically separates content.",
  },
];

export default services;
