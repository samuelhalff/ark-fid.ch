'use client';

import { hasCookie, setCookie } from 'cookies-next';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Gtag, gtag, initializeGtag } from '@/lib/gtag';

const CookieConsent = () => {
  const [showConsent, setShowConsent] = useState(false);
  const { t } = useTranslation('common');

  useEffect(() => {
    // Initialize GA with default consent settings
    initializeGtag();

    // Determine if the consent banner should be shown
    const consentCookie = hasCookie('cookie_consent');
    if (!consentCookie) {
      setShowConsent(true);
    } else {
      // If consent is already given, apply it
      const consent = JSON.parse(
        localStorage.getItem('cookie_consent') || 'null'
      );
      if (consent) {
        applyGtagConsent(consent);
      }
    }
  }, []);

  const applyGtagConsent = (consent: 'accepted' | 'minimal' | 'declined') => {
    if (consent === 'accepted') {
      gtag('consent', 'update', {
        ad_storage: 'granted',
        analytics_storage: 'granted',
      });
    } else if (consent === 'minimal') {
      gtag('consent', 'update', {
        ad_storage: 'denied',
        analytics_storage: 'granted',
      });
    } else {
      gtag('consent', 'update', {
        ad_storage: 'denied',
        analytics_storage: 'denied',
      });
    }
    // Store consent decision
    localStorage.setItem('cookie_consent', JSON.stringify(consent));
  };

  const handleConsent = (consent: 'accepted' | 'minimal' | 'declined') => {
    setCookie('cookie_consent', 'true', { maxAge: 365 * 24 * 60 * 60 });
    setShowConsent(false);
    applyGtagConsent(consent);

    // Track consent action
    if (Gtag.isInitialized()) {
      gtag('event', 'consent_given', {
        consent_level: consent,
      });
    }
  };

  if (!showConsent) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold">{t('cookie.title')}</h3>
        <p className="mb-4 text-sm text-gray-700">{t('cookie.message')}</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => handleConsent('declined')}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300"
          >
            {t('cookie.decline')}
          </button>
          <button
            onClick={() => handleConsent('minimal')}
            className="rounded-md bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
          >
            {t('cookie.minimal')}
          </button>
          <button
            onClick={() => handleConsent('accepted')}
            className="rounded-md bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600"
          >
            {t('cookie.accept')}
          </button>
        </div>
        <div className="mt-4 text-center text-xs text-gray-500">
          <Link href="/privacy" className="underline hover:text-gray-700">
            {t('cookie.privacy')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;