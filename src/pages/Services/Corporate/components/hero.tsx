import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui//button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import corporate from "@/assets/services/corporate-services.png";

const Hero = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
      <div className="max-w-screen-xl w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-y-14 gap-x-10 px-6 py-12 lg:py-0">
        <div className="max-w-xl animate-in fade-in duration-800">
          <div className="gap-2 flex justify-center items-center">
            <Badge className="rounded-full py-1 border-none">
              Corporate Services
            </Badge>
            <Badge
              variant="destructive"
              className="rounded-full py-1 border-none"
            >
              Gouvernance & conformit&eacute;
            </Badge>
          </div>
          <h1 className="mt-6 max-w-[20ch] text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold !leading-[1.2] tracking-tight">
            Votre soci&eacute;t&eacute;, notre expertise
          </h1>
          <p className="mt-6 max-w-[60ch] xs:text-lg">
            De la cr&eacute;ation &agrave; la transmission, Ark Fiduciaire vous
            accompagne dans toutes les &eacute;tapes de la vie de votre
            entreprise. B&eacute;n&eacute;ficiez d&rsquo;un accompagnement
            global, d&rsquo;une conformit&eacute; assur&eacute;e et d&rsquo;un
            support strat&eacute;gique sur mesure.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <a href="#presentation" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant={"outline"}
                className="w-full sm:w-auto rounded-full text-base"
                style={{ cursor: "pointer" }}
              >
                <ArrowDown className="!h-5 !w-5 animate-in slide-in-from-top-20 repeat-20 duration-800" />
                En savoir plus
              </Button>
            </a>
            <Link to="/contact" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base"
                style={{ cursor: "pointer" }}
              >
                Nous contacter <ArrowUpRight className="!h-5 !w-5" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <img
            src={corporate}
            alt=""
            className="object-cover rounded-xl brightness-100"
            style={{ height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
};

export default Hero;
