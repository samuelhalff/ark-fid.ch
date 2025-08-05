import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Linkedin } from "lucide-react";
import { useTranslation } from "react-i18next";

const teamMembers = [
  {
    name: "Hassan Barbir",
    role: "CEO & Co-Founder",
    avatarUrl:
      "https://www.helvegroup.ch/img/6a3757f6-5b26-49c6-83a1-a1377f044580/hassan-barbir.jpg?fm=jpg&q=60&fit=max&dpr=1&crop=1476%2C1476%2C0%2C87",
    social: {
      linkedin: "https://www.linkedin.com/in/jane-doe",
    },
  },
  {
    name: "Rodrigue Sperisen",
    role: "CTO & Co-Founder",
    avatarUrl:
      "https://www.helvegroup.ch/img/bc363d14-846d-4245-b403-b257cf213b9a/rodrigue-sperisen-nak-1781.jpg?fm=jpg&q=60&fit=max&dpr=1&crop=3200%2C3193%2C0%2C703",
    social: {
      linkedin: "https://www.linkedin.com/in/john-smith",
    },
  },
  {
    name: "Lassana Dioum",
    role: "Lead Designer",
    avatarUrl:
      "https://www.helvegroup.ch/img/5dee7b46-9ffc-4d69-96b7-4e52cc6c9df0/photo-lassana-2.jpg?fm=jpg&q=60&fit=max&dpr=1&crop=2001%2C2002%2C0%2C300",
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Peter Jones",
    role: "Lead Designer",
    avatarUrl:
      "https://www.helvegroup.ch/img/b94b95b6-765e-4c3c-b8c6-b269238db92d/anthony-touboul-nak-8695.jpg?fm=jpg&q=60&fit=max&dpr=1&crop=3335%2C3337%2C0%2C395",
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Peter Jones",
    role: "Lead Designer",
    avatarUrl:
      "https://www.helvegroup.ch/img/5dee7b46-9ffc-4d69-96b7-4e52cc6c9df0/photo-lassana-2.jpg?fm=jpg&q=60&fit=max&dpr=1&crop=2001%2C2002%2C0%2C300",
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Peter Jones",
    role: "Lead Designer",
    avatarUrl:
      "https://www.helvegroup.ch/img/214fbf70-71d2-4492-93da-fe44cea08a80/maurice-mandurrino.jpg?fm=jpg&q=60&fit=max&dpr=1&crop=3335%2C3337%2C0%2C628",
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
        {teamMembers.map((member, index) => (
          <a href={member.social.linkedin} key={index}>
            <Card
              key={member.name}
              className="text-center shadow-lg gap-2 py-5"
            >
              <CardHeader>
                <div className="aspect-[4/5] w-full rounded-md overflow-hidden mb-4">
                  <img
                    src={member.avatarUrl}
                    alt={`Portrait of ${member.name}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </CardHeader>
              <CardContent className="text-left h-12">
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                  {member.name}
                </h3>
              </CardContent>
              <CardFooter className="flex justify-center"></CardFooter>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
