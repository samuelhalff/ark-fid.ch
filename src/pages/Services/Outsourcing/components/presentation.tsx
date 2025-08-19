import {
  UserCheck,
  Clock,
  Settings,
  CheckCircle,
  Briefcase,
} from "lucide-react";
import { StylishList } from "@/components/ui/stylish-list";

const listItems = [
  {
    icon: <Briefcase className="text-primary min-w-[22px]" size={22} />,
    title: "Externalisation complète",
    desc: "Confiez-nous la gestion de vos fonctions administratives, comptables ou RH pour vous concentrer sur votre cœur de métier. Nous assurons une prise en charge globale, flexible et sécurisée de vos processus clés.",
  },
  {
    icon: <UserCheck className="text-primary min-w-[22px]" size={22} />,
    title: "Expertise dédiée",
    desc: "Bénéficiez de l’accompagnement de spécialistes expérimentés, à l’écoute de vos besoins et capables d’apporter des solutions sur mesure pour chaque aspect externalisé.",
  },
  {
    icon: <Clock className="text-primary min-w-[22px]" size={22} />,
    title: "Gain de temps et efficacité",
    desc: "Libérez-vous des tâches chronophages et optimisez vos ressources internes. Notre équipe garantit la continuité, la réactivité et la qualité de service.",
  },
  {
    icon: <Settings className="text-primary min-w-[22px]" size={22} />,
    title: "Technologies avancées",
    desc: "Nous utilisons des outils digitaux performants pour automatiser, sécuriser et fluidifier la gestion externalisée de vos activités.",
  },
  {
    icon: <CheckCircle className="text-primary min-w-[22px]" size={22} />,
    title: "Confidentialité et conformité",
    desc: "Vos données sont traitées dans le respect des normes de sécurité et de confidentialité les plus strictes, en totale conformité avec la législation suisse.",
  },
];

const OUTSOURCING_LIST = [
  "Externalisation administrative et comptable",
  "Gestion de la paie et des ressources humaines",
  "Support juridique et fiscal",
  "Mise à disposition d’outils digitaux",
  "Accompagnement sur mesure et reporting régulier",
];

const Presentation = () => {
  return (
    <section
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
        Externalisez, optimisez, développez
      </h1>
      <div className="max-w-3xl text-left">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          L’externalisation, un levier de performance pour votre entreprise
        </h2>
        <p className="mb-8 text-lg text-justify">
          L’externalisation de fonctions stratégiques permet aux entreprises de
          gagner en agilité, de réduire leurs coûts et de se recentrer sur leur
          développement. Ark Fiduciaire propose des solutions d’outsourcing
          adaptées à chaque structure, de la PME à la grande entreprise.
        </p>
        <p className="mb-8 text-lg text-justify">
          Notre équipe prend en charge la gestion administrative, comptable, RH
          ou juridique selon vos besoins, en garantissant confidentialité,
          conformité et efficacité. Nous mettons à votre disposition des outils
          digitaux performants pour un suivi transparent et un reporting
          régulier.
        </p>
        <StylishList
          items={OUTSOURCING_LIST}
          Icon={CheckCircle}
          iconClass="text-primary"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <section>
          <h3 className="text-2xl font-semibold mb-6">
            Nos atouts pour votre externalisation
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
