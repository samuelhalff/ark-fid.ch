import {
  FolderCode,
  Settings,
  UserCheck,
  CheckCircle,
  Lightbulb,
} from "lucide-react";
import { StylishList } from "@/components/ui/stylish-list";

const listItems = [
  {
    icon: <FolderCode className="text-primary min-w-[22px]" size={22} />,
    title: "Intégration Odoo sur mesure",
    desc: "Déploiement, paramétrage et personnalisation de la solution Odoo pour répondre précisément à vos besoins métiers. Nous assurons une transition fluide et un accompagnement complet.",
  },
  {
    icon: <Settings className="text-primary min-w-[22px]" size={22} />,
    title: "Automatisation des processus",
    desc: "Optimisation de vos flux de travail grâce à l’automatisation des tâches administratives, comptables, commerciales ou RH via Odoo.",
  },
  {
    icon: <UserCheck className="text-primary min-w-[22px]" size={22} />,
    title: "Formation et support",
    desc: "Accompagnement de vos équipes à chaque étape : formation, assistance technique et support continu pour garantir la réussite de votre projet Odoo.",
  },
  {
    icon: <CheckCircle className="text-primary min-w-[22px]" size={22} />,
    title: "Sécurité et conformité",
    desc: "Mise en place de solutions sécurisées, respectant les normes de confidentialité et de conformité en vigueur en Suisse.",
  },
  {
    icon: <Lightbulb className="text-primary min-w-[22px]" size={22} />,
    title: "Conseil et évolution",
    desc: "Nos experts vous conseillent sur l’évolution de votre système d’information et l’intégration de nouveaux modules Odoo selon la croissance de votre entreprise.",
  },
];

const ODOO_LIST = [
  "Analyse des besoins et audit des processus",
  "Déploiement et paramétrage d’Odoo",
  "Migration de données et intégration avec vos outils",
  "Formation des utilisateurs et support technique",
  "Évolution et maintenance de la solution",
];

const Presentation = () => {
  return (
    <section
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
        Odoo : digitalisez votre entreprise
      </h1>
      <div className="max-w-3xl text-left">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          Une solution ERP complète et évolutive
        </h2>
        <p className="mb-8 text-lg text-justify">
          Odoo est une solution ERP modulaire et flexible, idéale pour
          digitaliser et optimiser la gestion de votre entreprise. Ark
          Fiduciaire vous accompagne dans l’intégration, la personnalisation et
          l’évolution de votre système Odoo.
        </p>
        <p className="mb-8 text-lg text-justify">
          Nous analysons vos besoins, paramétrons les modules adaptés et formons
          vos équipes pour garantir une adoption rapide et efficace. Notre
          support technique assure la continuité et la sécurité de votre
          environnement Odoo.
        </p>
        <StylishList
          items={ODOO_LIST}
          Icon={CheckCircle}
          iconClass="text-primary"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <section>
          <h3 className="text-2xl font-semibold mb-6">
            Nos atouts pour votre transformation digitale
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
