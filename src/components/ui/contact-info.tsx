import React from "react";
import TranslatedText from "./translated-text";

// ContactInfo reads from the `contact` namespace so translations are centralised.
const ContactInfo: React.FC = () => {
  return (
    <div className="bg-muted/50 p-6 rounded-lg">
      <p className="font-semibold">
        <TranslatedText
          ns="contact"
          translationKey="Contact.CompanyName"
          fallbackText="Ark Fiduciaire"
        />
      </p>
      <p>
        <TranslatedText
          ns="contact"
          translationKey="Contact.Email"
          fallbackText="Email: info@ark-fid.ch"
        />
      </p>
      <p>
        <TranslatedText
          ns="contact"
          translationKey="Contact.Phone"
          fallbackText="Phone: +41 XX XXX XX XX"
        />
      </p>
      <p>
        <TranslatedText
          ns="contact"
          translationKey="Contact.Address"
          fallbackText="Address: 26 Boulevard Georges Favon, 1204 Geneva"
        />
      </p>
    </div>
  );
};

export default ContactInfo;
