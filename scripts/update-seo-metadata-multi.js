#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// SEO Metadata Updates for DE, ES, PT
const updates = {
  de: {
    pages: {
      '/': {
        title: 'Treuhand Genf – Buchhaltung & Steuerberatung | Ark Fiduciaire',
        description: 'Ark Fiduciaire in Genf bietet Treuhand-, Buchhaltungs-, Steuer-, Lohn- und Firmengründungsdienste für KMU und Unternehmer.',
        keywords: 'treuhand genf, buchhaltung genf, steuerberatung genf, firmengründung'
      },
      '/about': {
        title: 'Ark Fiduciaire Genf – Ihr lokaler Treuhand-Partner',
        description: 'Ark Fiduciaire ist eine vertrauenswürdige Treuhandkanzlei in Genf, die auf KMU und Einzelpersonen zugeschnittene Buchhaltungs-, Steuer- und Unternehmensdienstleistungen anbietet.',
        keywords: 'über ark fiduciaire, treuhand genf, genfer buchhalter, treuhandexperten'
      },
      '/contact': {
        title: 'Kontakt Ark Fiduciaire Genf | Treuhanddienste',
        description: 'Nehmen Sie Kontakt mit Ark Fiduciaire in Genf auf für Buchhaltung, Steuern, Lohn und Firmengründung.',
        keywords: 'kontakt treuhand genf, genfer buchhaltungsdienste, treuhand kontakt'
      },
      '/services': {
        title: 'Treuhanddienste in Genf – Ark Fiduciaire',
        description: 'Entdecken Sie unsere Treuhanddienste in Genf: Buchhaltung, Steuern, Lohn, Domizilierung und Firmengründung.',
        keywords: 'treuhanddienste genf, buchhaltungsdienste, steuerberatung genf'
      },
      '/services/accounting': {
        title: 'Buchhaltung & Buchführung Genf | Ark Fiduciaire',
        description: 'Professionelle Buchhaltung und Buchführung für KMU in Genf. Ark Fiduciaire kümmert sich um Jahresabschlüsse, Reporting und Beratung.',
        keywords: 'buchhaltung genf, buchführung, finanzberichterstattung genf'
      },
      '/services/taxes': {
        title: 'Steuerberatung & Steuererklärung Genf | Ark Fiduciaire',
        description: 'Ark Fiduciaire hilft bei Steuererklärungen, Compliance und Steuerplanung für Einzelpersonen und Unternehmen in Genf.',
        keywords: 'steuerberatung genf, steuererklärung, mwst, steuerplanung'
      },
      '/services/incorporation': {
        title: 'Firmengründung & Domizilierung Genf | Ark Fiduciaire',
        description: 'Gründen Sie Ihr Unternehmen in Genf mit Ark Fiduciaire. Wir übernehmen Domizilierung, rechtliche Einrichtung und Steueranmeldungen.',
        keywords: 'firmengründung genf, unternehmensgründung schweiz, handelsregister'
      },
      '/services/payroll': {
        title: 'Lohnbuchhaltung & Personalverwaltung Genf | Ark Fiduciaire',
        description: 'Ausgelagerte Lohn- und Personaldienste in Genf. Ark Fiduciaire gewährleistet Compliance und Effizienz für Ihr Unternehmen.',
        keywords: 'lohnbuchhaltung genf, personaldienste, lohnabrechnung, sozialversicherung'
      }
    }
  },
  es: {
    pages: {
      '/': {
        title: 'Servicios Fiduciarios Ginebra – Contabilidad e Impuestos | Ark Fiduciaire',
        description: 'Ark Fiduciaire en Ginebra ofrece servicios fiduciarios, contabilidad, impuestos, nómina y constitución de empresas para pymes y emprendedores.',
        keywords: 'fiduciario ginebra, contabilidad ginebra, servicios fiscales ginebra, constitución empresa'
      },
      '/about': {
        title: 'Ark Fiduciaire Ginebra – Su socio fiduciario local',
        description: 'Ark Fiduciaire es una firma fiduciaria de confianza en Ginebra, que ofrece servicios de contabilidad, impuestos y negocios adaptados a pymes e individuos.',
        keywords: 'sobre ark fiduciaire, fiduciario ginebra, contadores ginebra, expertos fiduciarios'
      },
      '/contact': {
        title: 'Contacto Ark Fiduciaire Ginebra | Servicios Fiduciarios',
        description: 'Póngase en contacto con Ark Fiduciaire en Ginebra para servicios de contabilidad, impuestos, nómina y constitución de empresas.',
        keywords: 'contacto fiduciario ginebra, servicios contables ginebra, contacto fiduciario'
      },
      '/services': {
        title: 'Servicios Fiduciarios en Ginebra – Ark Fiduciaire',
        description: 'Explore nuestros servicios fiduciarios en Ginebra: contabilidad, impuestos, nómina, domiciliación y constitución de empresas.',
        keywords: 'servicios fiduciarios ginebra, servicios contables, asesoría fiscal ginebra'
      },
      '/services/accounting': {
        title: 'Servicios de Contabilidad Ginebra | Ark Fiduciaire',
        description: 'Contabilidad profesional para pymes en Ginebra. Ark Fiduciaire se encarga de estados financieros, informes y asesoramiento.',
        keywords: 'contabilidad ginebra, servicios de teneduría, informes financieros ginebra'
      },
      '/services/taxes': {
        title: 'Asesoría Fiscal y Declaraciones Ginebra | Ark Fiduciaire',
        description: 'Ark Fiduciaire ayuda con declaraciones fiscales, cumplimiento y planificación fiscal para individuos y empresas en Ginebra.',
        keywords: 'asesoría fiscal ginebra, declaraciones impuestos, iva, planificación fiscal'
      },
      '/services/incorporation': {
        title: 'Constitución de Empresa y Domiciliación Ginebra | Ark Fiduciaire',
        description: 'Constituya su empresa en Ginebra con Ark Fiduciaire. Gestionamos domiciliación, configuración legal y registros fiscales.',
        keywords: 'constitución empresa ginebra, formación sociedad suiza, registro mercantil'
      },
      '/services/payroll': {
        title: 'Gestión de Nómina y RRHH Ginebra | Ark Fiduciaire',
        description: 'Servicios externalizados de nómina y RRHH en Ginebra. Ark Fiduciaire garantiza cumplimiento y eficiencia para su negocio.',
        keywords: 'gestión nómina ginebra, servicios rrhh, gestión salarial, seguridad social'
      }
    }
  },
  pt: {
    pages: {
      '/': {
        title: 'Serviços Fiduciários Genebra – Contabilidade e Impostos | Ark Fiduciaire',
        description: 'Ark Fiduciaire em Genebra oferece serviços fiduciários, contabilidade, impostos, folha de pagamento e constituição de empresas para PMEs e empreendedores.',
        keywords: 'fiduciário genebra, contabilidade genebra, serviços fiscais genebra, constituição empresa'
      },
      '/about': {
        title: 'Ark Fiduciaire Genebra – Seu parceiro fiduciário local',
        description: 'Ark Fiduciaire é uma empresa fiduciária confiável em Genebra, oferecendo serviços de contabilidade, impostos e negócios adaptados a PMEs e indivíduos.',
        keywords: 'sobre ark fiduciaire, fiduciário genebra, contadores genebra, especialistas fiduciários'
      },
      '/contact': {
        title: 'Contato Ark Fiduciaire Genebra | Serviços Fiduciários',
        description: 'Entre em contato com Ark Fiduciaire em Genebra para serviços de contabilidade, impostos, folha de pagamento e constituição de empresas.',
        keywords: 'contato fiduciário genebra, serviços contábeis genebra, contato fiduciário'
      },
      '/services': {
        title: 'Serviços Fiduciários em Genebra – Ark Fiduciaire',
        description: 'Explore nossos serviços fiduciários em Genebra: contabilidade, impostos, folha de pagamento, domiciliação e constituição de empresas.',
        keywords: 'serviços fiduciários genebra, serviços contábeis, consultoria fiscal genebra'
      },
      '/services/accounting': {
        title: 'Serviços de Contabilidade Genebra | Ark Fiduciaire',
        description: 'Contabilidade profissional para PMEs em Genebra. Ark Fiduciaire cuida de demonstrações financeiras, relatórios e assessoria.',
        keywords: 'contabilidade genebra, serviços de escrituração, relatórios financeiros genebra'
      },
      '/services/taxes': {
        title: 'Consultoria Fiscal e Declarações Genebra | Ark Fiduciaire',
        description: 'Ark Fiduciaire ajuda com declarações fiscais, conformidade e planejamento tributário para indivíduos e empresas em Genebra.',
        keywords: 'consultoria fiscal genebra, declarações impostos, iva, planejamento fiscal'
      },
      '/services/incorporation': {
        title: 'Constituição de Empresa e Domiciliação Genebra | Ark Fiduciaire',
        description: 'Constitua sua empresa em Genebra com Ark Fiduciaire. Gerenciamos domiciliação, configuração legal e registros fiscais.',
        keywords: 'constituição empresa genebra, formação sociedade suíça, registro comercial'
      },
      '/services/payroll': {
        title: 'Gestão de Folha de Pagamento e RH Genebra | Ark Fiduciaire',
        description: 'Serviços terceirizados de folha de pagamento e RH em Genebra. Ark Fiduciaire garante conformidade e eficiência para seu negócio.',
        keywords: 'gestão folha genebra, serviços rh, gestão salarial, segurança social'
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
console.log('Updating metadata files for DE, ES, PT with SEO improvements...\n');
updateMetadata('de', updates.de);
updateMetadata('es', updates.es);
updateMetadata('pt', updates.pt);

console.log('\n✓ All metadata files updated successfully!');
