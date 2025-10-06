#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// SEO Metadata Updates - natural, human-written style
const updates = {
  en: {
    pages: {
      '/': {
        title: 'Fiduciary services Geneva – accounting & tax | Ark Fiduciaire',
        description: 'Ark Fiduciaire in Geneva provides fiduciary, accounting, tax, payroll and company incorporation services for SMEs and entrepreneurs.',
        keywords: 'fiduciary geneva, accounting geneva, tax services geneva, company incorporation'
      },
      '/about': {
        title: 'Ark Fiduciaire Geneva – your local fiduciary partner',
        description: 'Ark Fiduciaire is a trusted fiduciary firm in Geneva, providing accounting, tax and business services tailored to SMEs and individuals.',
        keywords: 'about ark fiduciaire, fiduciary geneva, geneva accountants, fiduciary experts'
      },
      '/contact': {
        title: 'Contact Ark Fiduciaire Geneva | fiduciary services',
        description: 'Get in touch with Ark Fiduciaire in Geneva for accounting, tax, payroll and company incorporation services.',
        keywords: 'contact fiduciary geneva, geneva accounting services, fiduciary contact'
      },
      '/services': {
        title: 'Fiduciary services in Geneva – Ark Fiduciaire',
        description: 'Explore our fiduciary services in Geneva: accounting, tax, payroll, domiciliation, and company incorporation.',
        keywords: 'fiduciary services geneva, accounting services, tax advisory geneva'
      },
      '/services/accounting': {
        title: 'Accounting & bookkeeping services Geneva | Ark Fiduciaire',
        description: 'Accounting and bookkeeping for SMEs in Geneva. Ark Fiduciaire handles financial statements, reporting, and advisory.',
        keywords: 'accounting geneva, bookkeeping services, financial reporting geneva'
      },
      '/services/taxes': {
        title: 'Tax advisory & returns Geneva | Ark Fiduciaire',
        description: 'Ark Fiduciaire helps with tax declarations, compliance and tax planning for individuals and companies in Geneva.',
        keywords: 'tax advisory geneva, tax returns, vat services, tax planning'
      },
      '/services/incorporation': {
        title: 'Company incorporation & domiciliation Geneva | Ark Fiduciaire',
        description: 'Incorporate your company in Geneva with Ark Fiduciaire. We handle domiciliation, legal setup and tax registrations.',
        keywords: 'company incorporation geneva, company formation switzerland, business registration'
      },
      '/services/payroll': {
        title: 'Payroll & HR management Geneva | Ark Fiduciaire',
        description: 'Payroll and HR services in Geneva. Ark Fiduciaire ensures compliance and efficiency for your business.',
        keywords: 'payroll geneva, hr services, payroll management, social security'
      },
      '/ressources': {
        title: 'Fiduciary resources – Geneva | Ark Fiduciaire',
        description: 'Guides and articles on accounting, tax and payroll in Switzerland with actionable insights.',
        keywords: 'fiduciary resources, tax guides geneva, accounting insights'
      }
    }
  },
  fr: {
    pages: {
      '/': {
        title: 'Fiduciaire Genève – comptabilité, fiscalité & création | Ark Fiduciaire',
        description: 'Cabinet fiduciaire à Genève. Ark Fiduciaire accompagne entrepreneurs et PME en comptabilité, fiscalité, création d\'entreprise et domiciliation.',
        keywords: 'fiduciaire genève, comptabilité genève, fiscalité genève, création entreprise'
      },
      '/about': {
        title: 'Ark Fiduciaire Genève – votre partenaire fiduciaire de proximité',
        description: 'Ark Fiduciaire, cabinet de confiance à Genève, accompagne entreprises et particuliers dans leur gestion comptable et fiscale.',
        keywords: 'à propos ark fiduciaire, fiduciaire genève, experts comptables genève'
      },
      '/contact': {
        title: 'Contact Ark Fiduciaire Genève | fiduciaire à Genève',
        description: 'Contactez Ark Fiduciaire à Genève pour vos besoins en comptabilité, fiscalité, domiciliation et gestion d\'entreprise.',
        keywords: 'contact fiduciaire genève, services comptables genève, contact fiduciaire'
      },
      '/services': {
        title: 'Services fiduciaires à Genève – Ark Fiduciaire',
        description: 'Découvrez nos services fiduciaires à Genève : comptabilité, fiscalité, domiciliation, création de société, gestion salariale.',
        keywords: 'services fiduciaires genève, comptabilité, conseil fiscal genève'
      },
      '/services/accounting': {
        title: 'Comptabilité et gestion financière Genève | Ark Fiduciaire',
        description: 'Comptabilité pour PME et indépendants à Genève. Ark Fiduciaire assure votre tenue comptable, bouclements annuels et conseils financiers.',
        keywords: 'comptabilité genève, tenue de livres, reporting financier genève'
      },
      '/services/taxes': {
        title: 'Déclarations d\'impôts et optimisation fiscale Genève | Ark Fiduciaire',
        description: 'Ark Fiduciaire vous accompagne pour vos déclarations d\'impôts, optimisation fiscale et planification patrimoniale à Genève.',
        keywords: 'fiscalité genève, déclarations impôts, tva, conseil fiscal'
      },
      '/services/incorporation': {
        title: 'Création de société et domiciliation Genève | Ark Fiduciaire',
        description: 'Domiciliation et création d\'entreprise à Genève. Ark Fiduciaire simplifie vos démarches juridiques, administratives et fiscales.',
        keywords: 'création société genève, domiciliation genève, constitution entreprise'
      },
      '/services/payroll': {
        title: 'Gestion des salaires et ressources humaines Genève | Ark Fiduciaire',
        description: 'Gestion de vos salaires à Genève. Paie, assurances sociales et conformité légale pour PME à Genève.',
        keywords: 'gestion salaires genève, paie, rh, assurances sociales'
      },
      '/ressources': {
        title: 'Ressources fiduciaires – Genève | Ark Fiduciaire',
        description: 'Guides et articles sur la comptabilité, la fiscalité et la paie en Suisse avec perspectives pratiques.',
        keywords: 'ressources fiduciaires, guides fiscaux genève, analyses comptables'
      }
    }
  }
};

// Function to update metadata file
function updateMetadata(lang, updates) {
  const filePath = path.join(__dirname, '..', 'src', 'translations', lang, 'metadata.json');
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Update pages
    if (updates.pages) {
      for (const [route, metadata] of Object.entries(updates.pages)) {
        if (data.pages[route]) {
          data.pages[route] = { ...data.pages[route], ...metadata };
        }
      }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✓ Updated ${lang}/metadata.json`);
  } catch (error) {
    console.error(`✗ Error updating ${lang}/metadata.json:`, error.message);
  }
}

// Apply updates
console.log('Fixing capitalization in metadata files...\n');
updateMetadata('en', updates.en);
updateMetadata('fr', updates.fr);

console.log('\n✓ All metadata files updated with natural capitalization!');
