import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  BookCheck,
  ChartPie,
  FolderSync,
  Goal,
  Users,
  Zap,
} from "lucide-react";
import Service from "@/NavigationMenu/ServicesElements";

const Services = () => {
  return (
    <div
      id="services"
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6"
    >
      <h2 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight sm:max-w-xl sm:text-center sm:mx-auto">
        Boost Your Strategy with Smart Features
      </h2>
      <div className="mt-8 xs:mt-14 w-full mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
        {Service.map((Service) => (
          <Card
            key={Service.title}
            className="flex flex-col border rounded-xl overflow-hidden shadow-none"
          >
            <CardHeader>
              <div className="flex items-center gap-2 !mt-3 text-xl font-bold tracking-tight">
                {Service.icon}
                <h4 className="">{Service.title}</h4>
              </div>
              <p className="mt-1 text-left text-muted-foreground text-sm xs:text-[17px]">
                {Service.description}
              </p>
            </CardHeader>
            <CardContent className="mt-auto px-0 pb-0">
              <div className="bg-muted h-52 ml-6 rounded-tl-xl" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Services;
