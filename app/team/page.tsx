import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/src/components/ui/card";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
import hb from "assets/hb.jpg";
import cl from "assets/cl.png";
import rs from "assets/rs.jpg";
import ld from "assets/ld.png";
import sh from "assets/sh.jpg";
import at from "assets/at.jpg";
import sg from "assets/sg.jpg";

const teamMembers = [
  {
    name: "Hassan Barbir",
    role: "Partner",
    profilePic: hb,
    social: {
      linkedin: "https://www.linkedin.com/in/jane-doe",
    },
  },
  {
    name: "Samuel Halff",
    role: "ManagingPartner",
    profilePic: sh,
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Rodrigue Sperisen",
    role: "Partner",
    profilePic: rs,
    social: {
      linkedin: "https://www.linkedin.com/in/john-smith",
    },
  },

  {
    name: "Lassana Dioum",
    role: "Partner",
    profilePic: ld,
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Anthony Touboul",
    role: "Tax",
    profilePic: at,
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Celeste Leal",
    role: "OfficeProjectManager",
    profilePic: cl,
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Sébastien Gallié",
    role: "SeniorAccountant",
    profilePic: sg,
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
];

export default function TeamPage() {
  return (
    <div className="container mx-auto px-4 py-15">
      <div>
        <title>Notre équipe | Ark Fiduciaire</title>
        <meta
          name="description"
          content="Découvrez la vision holistique de la comptabilité proposée par Ark Fiduciaire : expertise, conseil, solutions personnalisées et technologies avancées pour la gestion de vos finances."
        />
        <meta
          name="keywords"
          content="comptabilité, conseil, Ark Fiduciaire, expertise, gestion financière, solutions personnalisées, dashboards, fiscalité, services sur mesure"
        />
      </div>
      <div className="text-center mb-12 animate-in fade-in duration-900">
        <h1 className=" text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold !leading-[1.2] tracking-tight">
          <TranslatedText
            translationKey={"Team.Title"}
            fallbackText={"Notre équipe"}
          />
        </h1>
        <p className="text-muted-foreground mt-2">
          <TranslatedText
            translationKey={"Team.Subtitle"}
            fallbackText={"Subtitle"}
          />
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-25 animate-in slide-in-from-bottom-7 duration-500">
        {teamMembers
          .sort(() => Math.random() - 0.5)
          .map((member) => (
            <a href={member.social.linkedin} key={member.name} className="">
              <Card
                className={
                  "animate-in fade-in duration-250 text-center shadow-none hover:shadow-lg transition-shadow gap-2 py-5 border-0 hover:brightness-115"
                }
              >
                <CardHeader>
                  <div className="aspect-[4/5] w-full rounded-md overflow-hidden mb-4 relative">
                    <Image
                      src={member.profilePic}
                      alt={`Portrait of ${member.name}`}
                      className="w-full h-full object-cover"
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      priority
                    />
                  </div>
                </CardHeader>
                <CardContent className="text-left h-12">
                  <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                    {member.name}
                    <div className="float-right">
                      <Image
                        width={25}
                        height={25}
                        className="opacity-80"
                        src="/assets/li.png"
                        alt="LinkedIn logo"
                        priority
                      />
                    </div>
                  </h3>
                  <h2>
                    <TranslatedText
                      translationKey={`Team.Role.${member.role}`}
                      fallbackText={member.role}
                    />
                  </h2>
                </CardContent>
                <CardFooter className="flex justify-center"></CardFooter>
              </Card>
            </a>
          ))}
      </div>
    </div>
  );
}
