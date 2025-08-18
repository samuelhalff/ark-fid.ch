import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  UserCheck,
  Clock,
  Settings,
  Lightbulb,
} from "lucide-react";

const listItems = [
  {
    icon: <UserCheck className="text-primary min-w-[22px]" size={22} />,
    title: "Experts",
    desc: "Ark Fiduciaire s'appuie sur une équipe de comptables et de fiscalistes expérimentés et certifiés, maîtrisant les réglementations locales et internationales. Cette expertise garantit des comptes précis et conformes, assurant une gestion fiable et harmonieuse.",
  },
  {
    icon: <Clock className="text-primary min-w-[22px]" size={22} />,
    title: "Gain de temps et efficacité",
    desc: "En externalisant la comptabilité à Ark Fiduciaire, les entreprises peuvent se concentrer sur leur activité principale. Nos services permettent de gagner du temps et d'améliorer l'efficacité opérationnelle, en prenant en charge la gestion complète des finances.",
  },
  {
    icon: <Settings className="text-primary min-w-[22px]" size={22} />,
    title: "Solutions personnalisées",
    desc: "Ark Fiduciaire propose des services de comptabilité sur mesure, adaptés aux besoins spécifiques de chaque client. Que vous soyez une petite entreprise, une grande société, une ONG ou une filiale, nous adaptons nos services pour répondre à vos attentes, offrant des solutions flexibles.",
  },
  {
    icon: <CheckCircle className="text-primary min-w-[22px]" size={22} />,
    title: "Technologie avancée et gestion en temps réel",
    desc: "Nous utilisons les dernières technologies et logiciels de comptabilité pour assurer une gestion optimale. Ces outils permettent une gestion précise et rapide des données financières, ainsi qu'un accès facile et sécurisé aux informations en temps réel.",
  },
  {
    icon: <Lightbulb className="text-primary min-w-[22px]" size={22} />,
    title: "Conseil",
    desc: "Chez Ark Fiduciaire, nous ne nous limitons pas à la tenue de vos livres. Nous proposons également un accompagnement en comptabilité de qualité. Nos experts vous aident à structurer vos finances, à planifier vos impôts et à gérer vos liquidités, tout en identifiant des opportunités d'amélioration.",
  },
];

const Presentation = () => {
  return (
    <section
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6"
      id="presentation"
    >
      <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left">
        Vision holistique de votre comptabilité
      </h1>
      <div className="max-w-3xl text-left">
        <h2 className="text-1xl xs:text-2xl md:text-2xl font-bold mb-6 md:leading-[2rem] tracking-tight text-left">
          Une offre à 360°
        </h2>
        <p className="mb-4 text-base">
          Nous nous consacrons à fournir des solutions complètes et
          personnalisées, conçues pour adresser chaque facette de vos besoins
          financiers et comptables avec précision et perspicacité.
        </p>
        <p className="mb-8 text-base">
          Au-delà des chiffres, nous offrons un conseil stratégique visant à
          soutenir votre croissance, à naviguer à travers les défis et à
          exploiter les opportunités de marché avec discernement. Nous sommes le
          partenaire stratégique engagé dans la réussite de votre entreprise.
        </p>
        <div className="space-y-10">
          <section>
            <h3 className="text-2xl font-semibold mb-2">
              Comptabilité générale
            </h3>
            <p className="mb-2 text-base">
              Chez Ark Fiduciaire, nous maîtrisons toutes les facettes de la
              comptabilité générale, du grand livre aux états financiers, en
              passant par la comptabilité de gestion. Nos professionnels
              veillent à ce que chaque livre de comptes soit tenu à jour, précis
              et conforme aux normes de l'industrie et aux réglementations en
              vigueur.
            </p>
            <ul className="list-disc list-inside mt-3 ml-4 mb-2 text-left space-y-1 text-base">
              <li>plan comptable personnalisé</li>
              <li>des créanciers et débiteurs</li>
              <li>des paiements</li>
              <li>de la trésorerie</li>
            </ul>
          </section>
          <section>
            <h3 className="text-2xl font-semibold mb-2">
              Comptabilité analytique
            </h3>
            <p className="text-base">
              La comptabilité analytique est un outil puissant pour comprendre
              où et comment vous générez des profits, ainsi que pour identifier
              les domaines qui nécessitent une attention particulière. Nos
              experts chez Ark Fiduciaire vous aideront à mettre en place et à
              analyser un système de comptabilité analytique efficace, qui vous
              permettra de prendre des décisions commerciales plus éclairées.
            </p>
          </section>
          <section>
            <h3 className="text-2xl font-semibold mb-2">Tâches périodiques</h3>
            <p className="mb-2 text-base">
              Découvrez une gestion sereine grâce à notre expertise dans
              l'établissement des décomptes périodiques pour toutes vos
              obligations, incluant :
            </p>
            <ul className="list-disc list-inside mt-3 ml-4 mb-2 text-left space-y-1 text-base">
              <li>clôture intermédiaire et/ou annuelle</li>
              <li>TVA semestrielle ou trimestrielle</li>
              <li>les assurances sociales</li>
              <li>déclaration fiscale</li>
              <li>assemblée générale ordinaire et extraordinaires</li>
              <li>conseil d'administration</li>
            </ul>
            <p className="text-base">
              Notre équipe dédiée vous accompagne à chaque étape, garantissant
              une gestion transparente et optimisée de vos décomptes, vous
              permettant ainsi de vous concentrer sur le cœur de votre activité.
            </p>
          </section>
          <section>
            <h3 className="text-2xl font-semibold mb-2">Dashboards</h3>
            <p className="text-base">
              Optimisez la visibilité et le contrôle de vos finances avec nos
              solutions de dashboard comptables innovantes. Les tableaux de bord
              offrent une synthèse claire et accessible de vos données
              financières, permettant une prise de décision éclairée et
              stratégique. Profitez d'une gestion simplifiée grâce à des
              dashboards intuitifs, adaptés à vos besoins spécifiques. Avec une
              interface conviviale et des analyses précises, nos solutions vous
              assurent une surveillance efficace de votre santé financière.
            </p>
          </section>
          <section>
            <h3 className="text-2xl font-semibold mb-2">
              Des services sur mesure
            </h3>
            <ul className="space-y-6 mt-4">
              {listItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-4">
                  <span className="mt-1">{item.icon}</span>
                  <div>
                    <span className="font-semibold text-base">
                      {item.title}
                    </span>
                    <span className="ml-1 text-base">: {item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
};

export default Presentation;
