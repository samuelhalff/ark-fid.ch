import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/src/components/ui/card";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
const teamMembers = [
  {
    name: "Hassan Barbir",
    role: "Partner",
    profilePic: "/assets/hb.jpg",
    social: {
      linkedin: "https://www.linkedin.com/in/jane-doe",
    },
  },
  {
    name: "Samuel Halff",
    role: "ManagingPartner",
    profilePic: "/assets/sh.jpg",
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Rodrigue Sperisen",
    role: "Partner",
    profilePic: "/assets/rs.jpg",
    social: {
      linkedin: "https://www.linkedin.com/in/john-smith",
    },
  },
  {
    name: "Lassana Dioum",
    role: "Partner",
    profilePic: "/assets/ld.png",
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Anthony Touboul",
    role: "Tax",
    profilePic: "/assets/at.jpg",
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Celeste Leal",
    role: "OfficeProjectManager",
    profilePic: "/assets/cl.png",
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
  {
    name: "Sébastien Gallié",
    role: "SeniorAccountant",
    profilePic: "/assets/sg.jpg",
    social: {
      linkedin: "https://www.linkedin.com/in/peter-jones",
    },
  },
];

export default function TeamPage() {
  return (
    <div className="container mx-auto px-4 py-15 mt-20 max-w-[var(--breakpoint-xl)]">
      <div className="text-center mb-12 animate-in fade-in duration-900">
        <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold leading-[1.2]! tracking-tight">
          <TranslatedText
            ns="team"
            translationKey={"Title"}
            fallbackText="Our Team"
          />
        </h1>
        <p className="text-muted-foreground mt-2">
          <TranslatedText
            ns="team"
            translationKey={"Subtitle"}
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
                  <div className="aspect-4/5 w-full rounded-md overflow-hidden mb-4 relative h-96">
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
                      ns="team"
                      translationKey={`Role.${member.role}`}
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
