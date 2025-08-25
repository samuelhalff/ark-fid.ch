import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import { headers } from 'next/headers';

export const locales = ['en', 'fr', 'de', 'es', 'pt'] as const;
export type Locale = (typeof locales)[number];

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function getCurrentLocale(): Locale {
  const headersList = headers();
  const locale = headersList.get('x-locale') || 'fr';
  return isValidLocale(locale) ? locale : 'fr';
}

export async function getTranslations(locale: Locale, namespace: string) {
  try {
    // Use fs to read the translation file
    const filePath = path.join(process.cwd(), 'src', 'translations', locale, `${namespace}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Return a function that can access nested properties
    return (key: string) => {
      const keys = key.split('.');
      let value = data;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key; // Return key if not found
        }
      }
      
      return value || key;
    };
  } catch (error) {
    // Fallback to English if translation not found
    try {
      const fallbackPath = path.join(process.cwd(), 'src', 'translations', 'en', `${namespace}.json`);
      const fallbackContent = fs.readFileSync(fallbackPath, 'utf8');
      const data = JSON.parse(fallbackContent);
      
      return (key: string) => {
        const keys = key.split('.');
        let value = data;
        
        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = value[k];
          } else {
            return key;
          }
        }
        
        return value || key;
      };
    } catch (fallbackError) {
      console.error(`Could not load translations for ${namespace}:`, error);
      return (key: string) => key; // Return key as fallback
    }
  }
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Alias for getTranslations for better naming in pages
export const loadTranslations = getTranslations;
