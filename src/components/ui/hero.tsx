import { ArrowUpRight, BadgeCheckIcon, Users } from "lucide-react";
import { Button } from "@/components/ui//button";
import { Badge } from "@/components/ui/badge";
import mainBG from "@/assets/main-bg.jpg";
import { useTranslation } from "react-i18next";
import odooLogo from "@/assets/odoo-logo.svg";
import { Link } from "react-router-dom";

const Hero = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
      <div className="max-w-screen-xl w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-y-14 gap-x-10 px-6 py-12 lg:py-0">
        <div className="max-w-xl text-center animate-in fade-in duration-800">
          <div className="gap-2 flex justify-center items-center">
            <Badge className="rounded-full py-1 border-none">
              {t("Hero.Badge")}
            </Badge>
            <Badge
              variant="destructive"
              className="rounded-full py-1 border-none"
            >
              {t("Hero.AI")}
            </Badge>
          </div>
          <h1 className="mt-6 max-w-[20ch] text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold !leading-[1.2] tracking-tight">
            {t("Hero.Title")}
          </h1>
          <p className="mt-6 max-w-[60ch] xs:text-lg">
            {t("Hero.Description")}
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link to="/contact" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base"
                style={{ cursor: "pointer" }}
              >
                {t("Hero.CTA")} <ArrowUpRight className="!h-5 !w-5" />
              </Button>
            </Link>
            <Link to="/team" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full text-base shadow-none"
                style={{ cursor: "pointer" }}
              >
                <Users className="!h-5 !w-5" /> {t("Hero.SecondaryCTA")}
              </Button>
            </Link>
          </div>
          <a
            href="https://www.odoo.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="mt-10 flex flex-col items-center justify-center">
              <img src={odooLogo} className="mt-0 w-24 h-16" alt="Odoo Logo" />
              <Badge
                variant="outline"
                className="rounded-full h-5 py-3 px-4 border-black bg-transparent mt-0 flex items-center justify-center"
              >
                <BadgeCheckIcon className="inline h-4 w-4 mr-1" />
                {t("Hero.OdooBadge")}
              </Badge>
            </div>
          </a>
        </div>
        <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <img
            src={mainBG}
            alt=""
            className="object-cover rounded-xl"
            style={{ height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
};

export default Hero;
