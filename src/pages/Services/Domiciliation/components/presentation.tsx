import { Mail, MapPin, Building2, UserCheck, CheckCircle } from "lucide-react";
import { StylishList } from "@/components/ui/stylish-list";

const listItems = [
  {
    icon: <MapPin className="text-primary min-w-[22px]" size={22} />,
    title: "Adresse prestigieuse",
    desc: "Bénéficiez d'une adresse professionnelle reconnue à Genève ou Lausanne, idéale pour renforcer la crédibilité et l'image de votre société auprès de vos partenaires et clients.",
  },
  {
    icon: <Mail className="text-primary min-w-[22px]" size={22} />,
    title: "Gestion du courrier",
    desc: "Réception, tri, numérisation et réexpédition de votre courrier selon vos instructions. Nous assurons une gestion efficace et confidentielle de tous vos documents administratifs.",
  },
  {
    icon: <Building2 className="text-primary min-w-[22px]" size={22} />,
    title: "Locaux et salles de réunion",
    desc: "Accès à des espaces de travail et à des salles de réunion modernes pour accueillir vos clients, partenaires ou collaborateurs dans un cadre professionnel.",
  },
  {
    icon: <UserCheck className="text-primary min-w-[22px]" size={22} />,
    title: "Accompagnement administratif",
    desc: "Assistance pour toutes vos démarches administratives : création d'entreprise, gestion des formalités, suivi des obligations légales et fiscales.",
  },
  {
    icon: <CheckCircle className="text-primary min-w-[22px]" size={22} />,
    title: "Flexibilité et confidentialité",
    desc: "Des solutions sur mesure, adaptables à l'évolution de votre activité, dans le respect total de la confidentialité de vos informations.",
  },
];

const DOMICILIATION_LIST = [
  "Adresse postale professionnelle à Genève ou Lausanne",
  "Gestion et réexpédition du courrier",
  "Mise à disposition de bureaux et salles de réunion",
  "Assistance administrative et juridique",
  "Accompagnement à la création d'entreprise",
];

const Presentation = () => {
  return (
    <section
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
        Domiciliation d'entreprise : votre adresse, notre expertise
      </h1>
      <div className="max-w-3xl text-left">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          Un service complet pour la domiciliation de votre société
        </h2>
        <p className="mb-8 text-lg text-justify">
          La domiciliation d'entreprise est une étape clé pour toute société
          souhaitant s'implanter ou renforcer sa présence en Suisse. Ark
          Fiduciaire vous accompagne dans le choix d'une adresse stratégique, la
          gestion administrative et la mise à disposition d'espaces
          professionnels adaptés à vos besoins.
        </p>
        <p className="mb-8 text-lg text-justify">
          Nos solutions de domiciliation incluent la gestion du courrier,
          l'accès à des bureaux et salles de réunion, ainsi qu'un accompagnement
          administratif personnalisé. Nous veillons à la conformité de votre
          société avec les exigences légales et fiscales locales, tout en
          garantissant la confidentialité de vos informations.
        </p>
        <StylishList
          items={DOMICILIATION_LIST}
          Icon={CheckCircle}
          iconClass="text-primary"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <section>
          <h3 className="text-2xl font-semibold mb-6">
            Nos atouts pour votre domiciliation
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
