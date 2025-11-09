import React, { useEffect, useState } from 'react';
import { labels } from 'your-labels-file';  // Don't forget to import labels file

const CookieConsent = () => {
    const [consent, setConsent] = useState(null);

    // Move applyGtagConsent function definition before the first useEffect
    const applyGtagConsent = (consent) => {
        if (consent) {
            // Logic for applying consent
        }
    };

    useEffect(() => {
        // Assuming this checks consent somehow
        if (consent === 'declined') {
            applyGtagConsent(false);  // Clear and simple logic
        } else if (consent === 'accepted') {
            applyGtagConsent(true);
        }
    }, [consent]);

    const handleAccept = () => setConsent('accepted');
    const handleDecline = () => setConsent('declined');

    return (
        <div>
            <button onClick={handleAccept}>{labels.Accept}</button>
            <button onClick={handleDecline}>{labels.Decline}</button>
        </div>
    );
};

export default CookieConsent;