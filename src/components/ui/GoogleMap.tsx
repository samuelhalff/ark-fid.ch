import React from "react";
// @ts-ignore - bundler resolution picks up .tsx file; type issue due to moduleResolution "bundler"
import GoogleMapClient from "./GoogleMapClient";

/**
 * GoogleMap component
 * - Responsive container with aspect ratio
 * - Dark mode border treatment
 * - Accepts coordinates & placeId for future extensibility
 */
export interface GoogleMapProps {
  title?: string;
  latitude?: number;
  longitude?: number;
  /** Google Place CID or place_id if you later want to deep link */
  cid?: string;
  className?: string;
  height?: number; // explicit px height override
  /** Delay loading the iframe until user consents */
  privacyMode?: boolean;
  /** Label texts (externalized for i18n) */
  labels?: {
    loadMap?: string;
    openInGoogle?: string;
    placeholderNotice?: string;
  };
}

const DEFAULT_LAT = 46.2039844;
const DEFAULT_LNG = 6.1426851;
// Real Ark Fiduciaire Google CID (example value – replace if needed)
export const ARK_GOOGLE_CID = "11595836239142935457";

// Server component wrapper (no hooks here)
export const GoogleMap = async ({
  title = "Ark Fiduciaire – Genève",
  latitude = DEFAULT_LAT,
  longitude = DEFAULT_LNG,
  cid = ARK_GOOGLE_CID,
  className = "",
  height,
  privacyMode = false,
  labels = {},
}: GoogleMapProps) => {
  // Pass props to client component (interactive toggle only)
  return (
    <GoogleMapClient
      title={title}
      latitude={latitude}
      longitude={longitude}
      cid={cid}
      className={className}
      height={height}
      privacyMode={privacyMode}
      labels={labels}
    />
  );
};

export default GoogleMap;
