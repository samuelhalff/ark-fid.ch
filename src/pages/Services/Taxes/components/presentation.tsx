import {
  CheckCircle,
  FileText,
  Briefcase,
  SearchCheck,
  Landmark,
} from "lucide-react";

const listItems = [
  {
    icon: <FileText className="text-primary min-w-[22px]" size={22} />,
    title: "Déclarations fiscales",
    desc: "Nos avocats fiscalistes et nos comptables vous accompagnent dans l'établissement de la déclaration fiscale annuelle de votre société ainsi que les diverses déclarations TVA. Nos experts vous guident dans le traitement des revenus, des déductions et des crédits d'impôt avec précision.",
  },
  {
    icon: <Briefcase className="text-primary min-w-[22px]" size={22} />,
    title: "Fiscalité des entreprises",
    desc: "Nos fiscalistes vous accompagnent au quotidien sur l'ensemble des impôts pouvant affecter votre activité, soit principalement l'impôt sur le bénéfice, l'impôt sur le capital, la TVA et les retenues d'impôts en lien avec la distribution de dividendes ou le paiement d'intérêts.",
  },
  {
    icon: <SearchCheck className="text-primary min-w-[22px]" size={22} />,
    title: "Audit fiscal",
    desc: "L'audit fiscal est une démarche cruciale dans la validation de la conformité des déclarations et paiements d'impôts en Suisse. Il s'agit d'une vérification approfondie, effectuée par des professionnels aguerris, scrutant chaque détail de la situation fiscale de l'entreprise pour s'assurer de son adhérence aux lois en vigueur. Un audit fiscal peut non seulement éviter des erreurs coûteuses mais également révéler des opportunités d'économies fiscales, faisant de cette procédure une composante stratégique dans la gestion financière d'une entité commerciale.",
  },
  {
    icon: <Landmark className="text-primary min-w-[22px]" size={22} />,
    title: "Ruling fiscaux",
    desc: "Nos experts se tiennent à votre côté dans le cadre de demande de ruling afin d'obtenir une sécurité juridique relative à votre situation fiscale. Nos avocats fiscalistes vous aideront à clarifier la façon dont une opération spécifique sera traitée sur le plan fiscal.",
  },
];

const Presentation = () => {
  return (
    <section
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6"
      id="presentation"
    >
      <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left">
        Nos fiscalistes à votre écoute
      </h1>
      <div className="max-w-3xl text-left">
        <p className="mb-4 text-lg text-justify">
          La compréhension et la navigation à travers le terrain complexe de la
          fiscalité représentent un défi omniprésent, particulièrement dans un
          contexte aussi multifacette que celui de la Suisse. Renommée pour sa
          stabilité économique et sa prospérité, la Suisse offre un système
          fiscal attractif mais aussi intrinsèquement complexe, avec ses divers
          niveaux de taxation et ses particularités cantonales.
        </p>
        <p className="mb-4 text-lg text-justify">
          Les entreprises opérant en Suisse se retrouvent face à une diversité
          d'obligations fiscales, qui varient non seulement en fonction du
          canton dans lequel elles opèrent, mais également selon leur structure
          juridique et leur secteur d’activité. Les impôts directs, TVA, droits
          de timbre, impôts anticipés et autres impositions nécessitent une
          gestion avisée pour optimiser la charge fiscale et garantir la
          conformité aux régulations en perpétuelle évolution.
        </p>
        <p className="mb-8 text-lg text-justify">
          Le conseil fiscal aux entreprises va bien au-delà de la simple
          conformité. Il s'agit d'une stratégie globale intégrant planification,
          conformité, et gestion des risques, veillant à aligner les obligations
          fiscales avec les objectifs à long terme de l'entreprise.
        </p>
        <div className="space-y-10">
          <section>
            <h2 className="text-1xl xs:text-2xl md:text-2xl font-bold mb-6 md:leading-[2rem] tracking-tight text-left">
              Chez Ark Fiduciaire, mettons à votre disposition l'expertise d'une
              équipe de fiscalistes et d'avocats fiscalistes.
            </h2>
          </section>
          <section>
            <h3 className="text-2xl font-semibold mb-2">
              La fiscalité réinventée
            </h3>
            <p className="mb-4 text-justify">
              La fiscalité, avec ses nuances et sa complexité, joue un rôle
              crucial dans la conduite et la gestion d'une entreprise en Suisse.
            </p>
            <p className="mb-4 text-justify">
              Chez Ark Fiduciaire, nos fiscalistes vous aident à naviguer avec
              assurance à travers les différentes règlementations fiscales,
              garantissant non seulement la conformité, mais aussi
              l'optimisation de vos obligations en la matière. Nos spécialistes
              s'engagent à vous fournir un service inégalé, assurant que chaque
              aspect de votre fiscalité est géré avec expertise et prévoyance.
            </p>
            <p className="mb-4 text-justify">
              Votre succès entrepreneurial passe par une gestion fiscale adroite
              et stratégique. Nous structurons notre accompagnement fiscal en
              plusieurs étapes déterminantes :
            </p>
            <ul className="mt-3 mb-2 text-left space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="text-primary mt-1" size={20} />
                <span>
                  <span className="font-semibold">Évaluation méticuleuse</span>{" "}
                  de votre profil fiscal et identification d'opportunités de
                  planification fiscale,
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-primary mt-1" size={20} />
                <span>
                  <span className="font-semibold">
                    Conseil et mise en œuvre
                  </span>{" "}
                  de stratégies fiscales visant à minimiser légalement votre
                  charge fiscale,
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-primary mt-1" size={20} />
                <span>
                  <span className="font-semibold">
                    Préparation et soumission
                  </span>{" "}
                  précises de vos déclarations fiscales,
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-primary mt-1" size={20} />
                <span>
                  <span className="font-semibold">Représentation</span> devant
                  les autorités fiscales en cas de vérifications et de litiges,
                  et
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-primary mt-1" size={20} />
                <span>
                  <span className="font-semibold">Anticipation et conseil</span>{" "}
                  sur les implications fiscales des décisions d'affaires.
                </span>
              </li>
            </ul>
            <p className="mb-4 text-justify">
              L'univers fiscal suisse, avec ses différentes couches de
              législation aux niveaux fédéral, cantonal et communal, exige une
              navigation habile. Que ce soit en matière d'impôt sur les
              bénéfices, de TVA, ou de droits de timbre, Ark Fiduciaire s’engage
              à vous assurer une tranquillité d’esprit, veillant à ce que toutes
              les exigences fiscales soient non seulement satisfaites, mais
              utilisées de manière stratégique pour propulser votre entreprise
              vers une croissance durable.
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
