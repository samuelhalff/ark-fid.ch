#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// SEO Metadata Updates for DE, ES, PT - natural capitalization
const updates = {
  de: {
    pages: {
      '/': {
        title: 'Treuhand Genf – Buchhaltung & Steuerberatung | Ark Fiduciaire',
        description: 'Ark Fiduciaire in Genf bietet Treuhand-, Buchhaltungs-, Steuer-, Lohn- und Firmengründungsdienste für KMU und Unternehmer.',
        keywords: 'treuhand genf, buchhaltung genf, steuerberatung genf, firmengründung'
      },
      '/about': {
        title: 'Ark Fiduciaire Genf – ihr lokaler Treuhand-Partner',
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
        description: 'Buchhaltung und Buchführung für KMU in Genf. Ark Fiduciaire kümmert sich um Jahresabschlüsse, Reporting und Beratung.',
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
        title: 'Lohn- und Personalverwaltung Genf | Ark Fiduciaire',
        description: 'Lohn- und HR-Dienstleistungen in Genf. Ark Fiduciaire gewährleistet Compliance und Effizienz für Ihr Unternehmen.',
        keywords: 'lohnabrechnung genf, hr-dienstleistungen, sozialversicherungen'
      },
      '/ressources': {
        title: 'Treuhandressourcen – Genf | Ark Fiduciaire',
        description: 'Leitfäden und Artikel zu Buchhaltung, Steuern und Löhnen in der Schweiz mit praktischen Einblicken.',
        keywords: 'treuhandressourcen, steuerleitfäden genf, buchhaltungseinblicke'
      }
    }
  },
  es: {
    pages: {
      '/': {
        title: 'Fiduciaria Ginebra – contabilidad, impuestos y creación | Ark Fiduciaire',
        description: 'Firma fiduciaria en Ginebra. Ark Fiduciaire acompaña a emprendedores y pymes en contabilidad, fiscalidad, creación de empresas y domiciliación.',
        keywords: 'fiduciaria ginebra, contabilidad ginebra, fiscalidad ginebra, creación empresa'
      },
      '/about': {
        title: 'Ark Fiduciaire Ginebra – su socio fiduciario de cercanía',
        description: 'Ark Fiduciaire, firma de confianza en Ginebra, acompaña a empresas y particulares en su gestión contable y fiscal.',
        keywords: 'acerca de ark fiduciaire, fiduciaria ginebra, asesores contables ginebra'
      },
      '/contact': {
        title: 'Contacto Ark Fiduciaire Ginebra | fiduciaria en Ginebra',
        description: 'Contacte con Ark Fiduciaire en Ginebra para sus necesidades de contabilidad, fiscalidad, domiciliación y gestión empresarial.',
        keywords: 'contacto fiduciaria ginebra, servicios contables ginebra, contacto fiduciaria'
      },
      '/services': {
        title: 'Servicios fiduciarios en Ginebra – Ark Fiduciaire',
        description: 'Descubra nuestros servicios fiduciarios en Ginebra: contabilidad, fiscalidad, domiciliación, creación de sociedades, gestión salarial.',
        keywords: 'servicios fiduciarios ginebra, contabilidad, asesoramiento fiscal ginebra'
      },
      '/services/accounting': {
        title: 'Contabilidad y gestión financiera Ginebra | Ark Fiduciaire',
        description: 'Contabilidad para pymes y autónomos en Ginebra. Ark Fiduciaire se encarga de su contabilidad, cierres anuales y asesoramiento financiero.',
        keywords: 'contabilidad ginebra, teneduría de libros, reporting financiero ginebra'
      },
      '/services/taxes': {
        title: 'Declaraciones de impuestos y optimización fiscal Ginebra | Ark Fiduciaire',
        description: 'Ark Fiduciaire le acompaña en sus declaraciones de impuestos, optimización fiscal y planificación patrimonial en Ginebra.',
        keywords: 'fiscalidad ginebra, declaraciones impuestos, iva, asesoramiento fiscal'
      },
      '/services/incorporation': {
        title: 'Creación de empresas y domiciliación Ginebra | Ark Fiduciaire',
        description: 'Domiciliación y creación de empresas en Ginebra. Ark Fiduciaire simplifica sus trámites jurídicos, administrativos y fiscales.',
        keywords: 'creación empresa ginebra, domiciliación ginebra, constitución empresa'
      },
      '/services/payroll': {
        title: 'Gestión de nóminas y recursos humanos Ginebra | Ark Fiduciaire',
        description: 'Gestión de nóminas en Ginebra. Nóminas, seguros sociales y cumplimiento legal para pymes en Ginebra.',
        keywords: 'gestión nóminas ginebra, nóminas, rrhh, seguros sociales'
      },
      '/ressources': {
        title: 'Recursos fiduciarios – Ginebra | Ark Fiduciaire',
        description: 'Guías y artículos sobre contabilidad, fiscalidad y nóminas en Suiza con perspectivas prácticas.',
        keywords: 'recursos fiduciarios, guías fiscales ginebra, análisis contables'
      }
    }
  },
  pt: {
    pages: {
      '/': {
        title: 'Fiduciária Genebra – contabilidade, impostos e criação | Ark Fiduciaire',
        description: 'Escritório fiduciário em Genebra. A Ark Fiduciaire acompanha empreendedores e PME em contabilidade, fiscalidade, criação de empresas e domiciliação.',
        keywords: 'fiduciária genebra, contabilidade genebra, fiscalidade genebra, criação empresa'
      },
      '/about': {
        title: 'Ark Fiduciaire Genebra – o seu parceiro fiduciário de proximidade',
        description: 'Ark Fiduciaire, escritório de confiança em Genebra, acompanha empresas e particulares na sua gestão contabilística e fiscal.',
        keywords: 'sobre ark fiduciaire, fiduciária genebra, consultores contabilísticos genebra'
      },
      '/contact': {
        title: 'Contacto Ark Fiduciaire Genebra | fiduciária em Genebra',
        description: 'Contacte a Ark Fiduciaire em Genebra para as suas necessidades de contabilidade, fiscalidade, domiciliação e gestão empresarial.',
        keywords: 'contacto fiduciária genebra, serviços contabilísticos genebra, contacto fiduciária'
      },
      '/services': {
        title: 'Serviços fiduciários em Genebra – Ark Fiduciaire',
        description: 'Descubra os nossos serviços fiduciários em Genebra: contabilidade, fiscalidade, domiciliação, criação de sociedades, gestão salarial.',
        keywords: 'serviços fiduciários genebra, contabilidade, consultoria fiscal genebra'
      },
      '/services/accounting': {
        title: 'Contabilidade e gestão financeira Genebra | Ark Fiduciaire',
        description: 'Contabilidade para PME e trabalhadores independentes em Genebra. A Ark Fiduciaire assegura a sua contabilidade, fechos anuais e consultoria financeira.',
        keywords: 'contabilidade genebra, escrituração, reporting financeiro genebra'
      },
      '/services/taxes': {
        title: 'Declarações de impostos e otimização fiscal Genebra | Ark Fiduciaire',
        description: 'A Ark Fiduciaire acompanha-o nas suas declarações de impostos, otimização fiscal e planeamento patrimonial em Genebra.',
        keywords: 'fiscalidade genebra, declarações impostos, iva, consultoria fiscal'
      },
      '/services/incorporation': {
        title: 'Criação de empresas e domiciliação Genebra | Ark Fiduciaire',
        description: 'Domiciliação e criação de empresas em Genebra. A Ark Fiduciaire simplifica os seus trâmites jurídicos, administrativos e fiscais.',
        keywords: 'criação empresa genebra, domiciliação genebra, constituição empresa'
      },
      '/services/payroll': {
        title: 'Gestão de salários e recursos humanos Genebra | Ark Fiduciaire',
        description: 'Gestão de salários em Genebra. Salários, seguros sociais e conformidade legal para PME em Genebra.',
        keywords: 'gestão salários genebra, salários, rh, seguros sociais'
      },
      '/ressources': {
        title: 'Recursos fiduciários – Genebra | Ark Fiduciaire',
        description: 'Guias e artigos sobre contabilidade, fiscalidade e salários na Suíça com perspetivas práticas.',
        keywords: 'recursos fiduciários, guias fiscais genebra, análises contabilísticas'
      }
    }
  },
  es: {
    pages: {
      '/': {
        title: 'Servicios fiduciarios Ginebra – contabilidad e impuestos | Ark Fiduciaire',
        description: 'Ark Fiduciaire en Ginebra ofrece servicios fiduciarios, contabilidad, impuestos, nómina y constitución de empresas para pymes y emprendedores.',
        keywords: 'fiduciario ginebra, contabilidad ginebra, servicios fiscales ginebra, constitución empresa'
      },
      '/about': {
        title: 'Ark Fiduciaire Ginebra – su socio fiduciario local',
        description: 'Ark Fiduciaire es una firma fiduciaria de confianza en Ginebra, que ofrece servicios de contabilidad, impuestos y negocios adaptados a pymes e individuos.',
        keywords: 'sobre ark fiduciaire, fiduciario ginebra, contadores ginebra, expertos fiduciarios'
      },
      '/contact': {
        title: 'Contacto Ark Fiduciaire Ginebra | servicios fiduciarios',
        description: 'Póngase en contacto con Ark Fiduciaire en Ginebra para servicios de contabilidad, impuestos, nómina y constitución de empresas.',
        keywords: 'contacto fiduciario ginebra, servicios contables ginebra, contacto fiduciario'
      },
      '/services': {
        title: 'Servicios fiduciarios en Ginebra – Ark Fiduciaire',
        description: 'Explore nuestros servicios fiduciarios en Ginebra: contabilidad, impuestos, nómina, domiciliación y constitución de empresas.',
        keywords: 'servicios fiduciarios ginebra, servicios contables, asesoría fiscal ginebra'
      },
      '/services/accounting': {
        title: 'Servicios de contabilidad Ginebra | Ark Fiduciaire',
        description: 'Contabilidad para pymes en Ginebra. Ark Fiduciaire se encarga de estados financieros, informes y asesoramiento.',
        keywords: 'contabilidad ginebra, servicios de teneduría, informes financieros ginebra'
      },
      '/services/taxes': {
        title: 'Asesoría fiscal y declaraciones Ginebra | Ark Fiduciaire',
        description: 'Ark Fiduciaire ayuda con declaraciones fiscales, cumplimiento y planificación fiscal para individuos y empresas en Ginebra.',
        keywords: 'asesoría fiscal ginebra, declaraciones impuestos, iva, planificación fiscal'
      },
      '/services/incorporation': {
        title: 'Constitución de empresa y domiciliación Ginebra | Ark Fiduciaire',
        description: 'Constituya su empresa en Ginebra con Ark Fiduciaire. Gestionamos domiciliación, configuración legal y registros fiscales.',
        keywords: 'constitución empresa ginebra, formación sociedad suiza, registro mercantil'
      },
      '/services/payroll': {
        title: 'Gestión de nómina y RRHH Ginebra | Ark Fiduciaire',
        description: 'Servicios de nómina y RRHH en Ginebra. Ark Fiduciaire garantiza cumplimiento y eficiencia para su negocio.',
        keywords: 'gestión nómina ginebra, servicios rrhh, gestión salarial, seguridad social'
      }
    }
  },
  pt: {
    pages: {
      '/': {
        title: 'Serviços fiduciários Genebra – contabilidade e impostos | Ark Fiduciaire',
        description: 'Ark Fiduciaire em Genebra oferece serviços fiduciários, contabilidade, impostos, folha de pagamento e constituição de empresas para PMEs e empreendedores.',
        keywords: 'fiduciário genebra, contabilidade genebra, serviços fiscais genebra, constituição empresa'
      },
      '/about': {
        title: 'Ark Fiduciaire Genebra – seu parceiro fiduciário local',
        description: 'Ark Fiduciaire é uma empresa fiduciária confiável em Genebra, oferecendo serviços de contabilidade, impostos e negócios adaptados a PMEs e indivíduos.',
        keywords: 'sobre ark fiduciaire, fiduciário genebra, contadores genebra, especialistas fiduciários'
      },
      '/contact': {
        title: 'Contato Ark Fiduciaire Genebra | serviços fiduciários',
        description: 'Entre em contato com Ark Fiduciaire em Genebra para serviços de contabilidade, impostos, folha de pagamento e constituição de empresas.',
        keywords: 'contato fiduciário genebra, serviços contábeis genebra, contato fiduciário'
      },
      '/services': {
        title: 'Serviços fiduciários em Genebra – Ark Fiduciaire',
        description: 'Explore nossos serviços fiduciários em Genebra: contabilidade, impostos, folha de pagamento, domiciliação e constituição de empresas.',
        keywords: 'serviços fiduciários genebra, serviços contábeis, consultoria fiscal genebra'
      },
      '/services/accounting': {
        title: 'Serviços de contabilidade Genebra | Ark Fiduciaire',
        description: 'Contabilidade para PMEs em Genebra. Ark Fiduciaire cuida de demonstrações financeiras, relatórios e assessoria.',
        keywords: 'contabilidade genebra, serviços de escrituração, relatórios financeiros genebra'
      },
      '/services/taxes': {
        title: 'Consultoria fiscal e declarações Genebra | Ark Fiduciaire',
        description: 'Ark Fiduciaire ajuda com declarações fiscais, conformidade e planejamento tributário para indivíduos e empresas em Genebra.',
        keywords: 'consultoria fiscal genebra, declarações impostos, iva, planejamento fiscal'
      },
      '/services/incorporation': {
        title: 'Constituição de empresa e domiciliação Genebra | Ark Fiduciaire',
        description: 'Constitua sua empresa em Genebra com Ark Fiduciaire. Gerenciamos domiciliação, configuração legal e registros fiscais.',
        keywords: 'constituição empresa genebra, formação sociedade suíça, registro comercial'
      },
      '/services/payroll': {
        title: 'Gestão de folha de pagamento e RH Genebra | Ark Fiduciaire',
        description: 'Serviços de folha de pagamento e RH em Genebra. Ark Fiduciaire garante conformidade e eficiência para seu negócio.',
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
console.log('Fixing capitalization in DE, ES, PT metadata files...\n');
updateMetadata('de', updates.de);
updateMetadata('es', updates.es);
updateMetadata('pt', updates.pt);

console.log('\n✓ All metadata files updated with natural capitalization!');
