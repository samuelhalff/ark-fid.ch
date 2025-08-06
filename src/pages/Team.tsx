import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import hb from "@/assets/hb.jpg";
import cl from "@/assets/cl.png";
import rs from "@/assets/rs.jpg";
import ld from "@/assets/ld.png";
import sh from "@/assets/sh.jpg";
import at from "@/assets/at.jpg";
import linkedInLogo from "@/assets/li.png";

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
    role: "Managing Partner",
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
    role: "Office & Projet Manager",
    profilePic: cl,
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
];

export default function TeamPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold">{t("Team.Title")}</h1>
        <p className="text-muted-foreground mt-2">{t("Team.Subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {teamMembers
          .sort(() => Math.random() - 0.5)
          .map((member, index) => (
            <a href={member.social.linkedin} key={member.name} className="">
              <Card
                className={
                  "animate-in fade-in duration-250 text-center shadow-none hover:shadow-lg transition-shadow gap-2 py-5 border-0"
                }
              >
                <CardHeader>
                  <div className="aspect-[4/5] w-full rounded-md overflow-hidden mb-4">
                    <img
                      src={member.profilePic}
                      alt={`Portrait of ${member.name}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CardHeader>
                <CardContent className="text-left h-12">
                  <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                    {member.name}
                    <div className="float-right">
                      {
                        <img
                          width={25}
                          className="opacity-80"
                          src={linkedInLogo}
                        />
                      }
                    </div>
                  </h3>
                  <h2>{member.role}</h2>
                </CardContent>
                <CardFooter className="flex justify-center"></CardFooter>
              </Card>
            </a>
          ))}
      </div>
    </div>
  );
}
