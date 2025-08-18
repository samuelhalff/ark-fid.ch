import {
  CheckCircle,
  UserCheck,
  Clock,
  Settings,
  Lightbulb,
} from "lucide-react";

const listItems = [
  {
    title: "Simulations de salaires",
    desc: "En incorporant divers éléments, tels que les augmentations de salaire, les bonus, les charges sociales et les avantages en nature, nos experts créent des modèles de simulation de salaires sur mesure, vous offrant des insights précieux et soutenant des décisions éclairées. À travers ces simulations, vous serez mieux équipées pour élaborer des stratégies de rémunération compétitives, garantissant à la fois la satisfaction des employés et la viabilité financière.",
    icon: <UserCheck className="text-primary min-w-[22px]" size={22} />,
  },
  {
    title: "Établissement des bulletins de salaire",
    desc: "L'établissement des bulletins de salaire représente une tâche cruciale dans toute entreprise, synonyme de conformité légale et de transparence envers les employés. Chez Ark Fiduciaire, nous transformons cette obligation en une démarche simplifiée et précise pour les sociétés en Suisse romande, notamment grâce à la technologie mise à votre disposition. Nos experts garantissent une élaboration rigoureuse des bulletins, intégrant salaires, primes, déductions et autres variables.",
    icon: <Clock className="text-primary min-w-[22px]" size={22} />,
  },
  {
    title: "Établissement des certificats de salaire annuels",
    desc: "L'établissement des bulletins de salaire annuels requiert une expertise et une précision irréprochables. Chez Ark Fiduciaire, nous vous offrons ce service essentiel, garantissant une exactitude sans faille.",
    icon: <Settings className="text-primary min-w-[22px]" size={22} />,
  },
  {
    title: "Déclarations de l’impôt à la source",
    desc: "Les déclarations de l'impôt à la source constituent un maillon essentiel dans la conformité fiscale des entreprises en Suisse. Chez Ark Fiduciaire, nous veillons à une gestion rigoureuse et conforme des déclarations. Nos experts naviguent avec habileté à travers les nuances des réglementations fiscales, assurant des déclarations précises et ponctuelles.",
    icon: <CheckCircle className="text-primary min-w-[22px]" size={22} />,
  },
  {
    title:
      "Coordination avec les assurances sociales et la prévoyance professionnelle",
    desc: "La coordination avec les assurances sociales et la prévoyance professionnelle, les déclarations AVS et les décomptes annuels des assurances sociales, sont des aspects cruciaux de la gestion d'entreprise en Suisse. Ark Fiduciaire vous assure, notamment en partenariat avec sa branche assurance HelveBroker, une gestion sereine et fluide de ces démarches avec un seul point de contact.",
    icon: <Lightbulb className="text-primary min-w-[22px]" size={22} />,
  },
];

const Presentation = () => {
  return (
    <section
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6"
      id="presentation"
    >
      <div>
        <title>Service RH dédié & Payroll | Ark Fiduciaire</title>
        <meta
          name="description"
          content="Ark Fiduciaire propose une gestion du payroll à 360° en Suisse romande : gestion des salaires, conseils RH, simulations, bulletins, certificats, déclarations fiscales et coordination assurances."
        />
        <meta
          name="keywords"
          content="payroll, RH, gestion des salaires, Ark Fiduciaire, Suisse romande, bulletins de salaire, certificats, impôt à la source, assurances sociales, conseil RH, simulations de salaires"
        />
      </div>
      <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left">
        Service RH dédié
      </h1>
      <div className="max-w-3xl text-left">
        <p className="mb-6 text-base">
          Dans l'écosystème entrepreneurial en Suisse romande, la gestion du
          payroll occupe une place centrale, alliant précision, conformité et
          efficacité. Chez Ark Fiduciaire, nous comprenons profondément cette
          nécessité et proposons une offre à 360°, englobant tous les aspects du
          payroll.
        </p>
        <p className="mb-6 text-base">
          Notre approche holistique à la gestion des salaires garantit que
          chaque élément, des salaires de base aux bonus et avantages divers,
          est méticuleusement géré, assurant une satisfaction optimale des
          employés et une conformité réglementaire.
        </p>
        <p className="mb-6 text-base">
          Nous mettons à votre disposition des solutions technologiques de
          pointe vous permettent également de simplifier et optimiser vos
          processus de gestion des emploies et de paie, offrant une précision
          sans faille et un accès en temps réel aux données cruciales.
        </p>
        <p className="mb-6 text-base">
          Notre offre ne se limite pas aux chiffres et aux bulletins de salaire.
          Nous nous consacrons également à fournir des conseils stratégiques en
          gestion du personnel, aidant votre entreprise à maximiser la
          productivité, la satisfaction et la rétention des employés à travers
          des stratégies de rémunération innovantes.
        </p>
        <p className="mb-6 text-base">
          Par ailleurs, grâce à notre branche Assurances, nous pouvons établir
          des projections et des modèles complexes de manière particulièrement
          transparente et efficace.
        </p>
        <p className="mb-10 text-base">
          Chez Ark Fiduciaire, nous sommes plus que de simples gestionnaires de
          paie. Nous sommes vos partenaires stratégiques, nous engageant à
          fournir une excellence opérationnelle dans tous les aspects de la
          gestion du payroll.
        </p>
        <div className="space-y-12">
          <section>
            <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-6 md:leading-[2rem] tracking-tight">
              Nos services payroll
            </h2>
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
