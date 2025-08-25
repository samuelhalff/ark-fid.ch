"use client";
import React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

interface TranslatedMarkdownProps {
  translatedKey: string;
  fallback: string;
  ns?: string;
}

const TranslatedMarkdown: React.FC<TranslatedMarkdownProps> = ({
  translatedKey,
  fallback,
  ns = "ressources",
}) => {
  const { t } = useTranslation(ns);
  // If translation is missing, fallback to provided fallback
  const value = t(translatedKey, fallback);
  return <ReactMarkdown>{value}</ReactMarkdown>;
};

export default TranslatedMarkdown;
