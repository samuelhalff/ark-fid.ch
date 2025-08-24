"use client";

import { useTranslation } from "react-i18next";

interface TranslatedDateProps {
  /**
   * The date to format. Can be a Date object, ISO string, or any format accepted by Date constructor
   */
  date: Date | string | number;

  /**
   * Optional formatting options for Intl.DateTimeFormat
   */
  options?: Intl.DateTimeFormatOptions;

  /**
   * Optional locale override. If not provided, uses current i18n locale
   */
  locale?: string;

  /**
   * Optional className for styling
   */
  className?: string;
}

const TranslatedDate = ({
  date,
  options = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
  locale,
  className,
}: TranslatedDateProps) => {
  const { i18n } = useTranslation();

  // Use provided locale or fall back to current i18n language
  const currentLocale = locale || i18n.language || "en";

  // Convert date to Date object if it's not already
  const dateObj = new Date(date);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    console.warn("TranslatedDate: Invalid date provided:", date);
    return <span className={className}>Invalid Date</span>;
  }

  try {
    // Format the date using Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat(currentLocale, options);
    const formattedDate = formatter.format(dateObj);

    return <span className={className}>{formattedDate}</span>;
  } catch (error) {
    console.error("TranslatedDate: Error formatting date:", error);
    return <span className={className}>{dateObj.toLocaleDateString()}</span>;
  }
};

export default TranslatedDate;
