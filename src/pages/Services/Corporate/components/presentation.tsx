import {
  Building2,
  UserCheck,
  FileText,
  CheckCircle,
  Lightbulb,
  Briefcase,
} from "lucide-react";
import { StylishList } from "@/components/ui/stylish-list";

const listItems = [
  {
    icon: <Building2 className="text-primary min-w-[22px]" size={22} />,
    title: "Création et gestion de sociétés",
    desc: "Accompagnement complet pour la constitution, la transformation ou la liquidation de sociétés. Nous gérons toutes les formalités administratives et juridiques pour une implantation sereine en Suisse.",
  },
  {
    icon: <UserCheck className="text-primary min-w-[22px]" size={22} />,
    title: "Gouvernance et secrétariat",
    desc: "Organisation des conseils d’administration, rédaction des procès-verbaux, gestion des assemblées générales et suivi des obligations légales.",
  },
  {
    icon: <FileText className="text-primary min-w-[22px]" size={22} />,
    title: "Conformité et veille réglementaire",
    desc: "Surveillance continue des évolutions légales et réglementaires, mise en conformité de votre structure et gestion des risques.",
  },
  {
    icon: <CheckCircle className="text-primary min-w-[22px]" size={22} />,
    title: "Support administratif et fiscal",
    desc: "Gestion des démarches administratives, fiscales et sociales, pour vous permettre de vous concentrer sur le développement de votre activité.",
  },
  {
    icon: <Lightbulb className="text-primary min-w-[22px]" size={22} />,
    title: "Conseil stratégique",
    desc: "Nos experts vous accompagnent dans la structuration, la croissance et la transmission de votre entreprise, avec des solutions sur mesure.",
  },
];

const CORPORATE_LIST = [
  "Création et domiciliation de sociétés",
  "Gestion des conseils d’administration et assemblées générales",
  "Mise en conformité réglementaire",
  "Support administratif et fiscal",
  "Conseil en structuration et transmission d’entreprise",
];

const Presentation = () => {
  return (
    <section
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
        Corporate Services : votre partenaire de confiance
      </h1>
      <div className="max-w-3xl text-left">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          Un accompagnement global pour la vie de votre société
        </h2>
        <p className="mb-8 text-lg text-justify">
          Ark Fiduciaire propose une gamme complète de services corporate pour
          accompagner les entreprises à chaque étape de leur développement. De
          la création à la transmission, nous vous guidons dans toutes les
          démarches administratives, juridiques et fiscales.
        </p>
        <p className="mb-8 text-lg text-justify">
          Notre équipe d’experts assure la conformité de votre structure, la
          gestion des conseils d’administration et des assemblées générales,
          ainsi que le suivi des obligations légales. Nous vous aidons à
          structurer et à pérenniser votre activité en toute sérénité.
        </p>
        <StylishList
          items={CORPORATE_LIST}
          Icon={CheckCircle}
          iconClass="text-primary"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <section>
          <h3 className="text-2xl font-semibold mb-6">
            Nos atouts pour votre gouvernance
          </h3>
          <ul className="space-y-6 mt-4">
            {listItems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-4 px-4 py-3 rounded-xl bg-muted/50 shadow-none hover:shadow-md transition-shadow"
              >
                <span className="mt-1">{item.icon}</span>
                <div>
                  <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    {item.title}
                  </span>
                  <span className="ml-1 text-lg text-gray-700 dark:text-gray-300">
                    : {item.desc}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
};

export default Presentation;
