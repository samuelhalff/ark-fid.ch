"use client";
import React, { useState } from "react";
import { ARK_GOOGLE_CID, GoogleMapProps } from "./GoogleMap";

interface ClientProps extends GoogleMapProps {}

const GoogleMapClient: React.FC<ClientProps> = ({
  title = "Ark Fiduciaire SA",
  latitude = 46.2021556,
  longitude = 6.1399595,
  cid = ARK_GOOGLE_CID,
  className = "",
  height,
  privacyMode = true,
  labels = {},
}) => {
  const [consented, setConsented] = useState(!privacyMode);
  const cidHex = BigInt(cid).toString(16);
  const mapSrc = `https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d2760.410640687776!2d${longitude}!3d${latitude}!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x478c65f758b086cb%3A0x${cidHex}!2sArk%20Fiduciaire%20SA!5e0!3m2!1sfr!2sch!4v${Date.now()}`;
  const {
    loadMap = "Afficher la carte interactive",
    openInGoogle = "Ouvrir dans Google Maps",
    placeholderNotice = "Pour des raisons de confidentialité, la carte n'est pas chargée automatiquement.",
  } = labels;
  return (
    <figure
      className={`group rounded-xl border border-slate-200 dark:border-slate-700/70 overflow-hidden shadow-sm bg-white dark:bg-slate-900 ${className}`}
    >
      <div
        className="relative w-full"
        style={height ? { height } : { aspectRatio: "16/7" }}
      >
        {consented ? (
          <iframe
            title={title}
            aria-label={title}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full border-0"
            src={mapSrc}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
              {placeholderNotice}
            </p>
            <button
              type="button"
              onClick={() => setConsented(true)}
              className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
            >
              {loadMap}
            </button>
            <a
              href={`https://maps.google.com/?cid=${cid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 underline"
            >
              {openInGoogle}
            </a>
          </div>
        )}
      </div>
      <figcaption className="flex items-center justify-between px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700/60">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {title}
        </span>
        <a
          href={`https://maps.google.com/?cid=${cid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {openInGoogle}
        </a>
      </figcaption>
    </figure>
  );
};

export default GoogleMapClient;
