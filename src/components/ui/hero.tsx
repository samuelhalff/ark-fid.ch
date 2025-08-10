import { ArrowUpRight, CirclePlay } from "lucide-react";
import { Button } from "./button";
import { Badge } from "@/components/ui/badge";
import mainBG from "@/assets/main-bg.jpg";

const Hero = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
      <div className="max-w-screen-xl w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-y-14 gap-x-10 px-6 py-12 lg:py-0">
        <div className="max-w-xl">
          <Badge className="rounded-full py-1 border-none">Swiss made</Badge>
          <h1 className="mt-6 max-w-[20ch] text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold !leading-[1.2] tracking-tight">
            Accounting, tax & payroll services
          </h1>
          <p className="mt-6 max-w-[60ch] xs:text-lg">
            We provide comprehensive accounting, tax, and payroll services
            tailored to your business needs. Our expert team ensures compliance
            and efficiency, allowing you to focus on growth.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full text-base"
            >
              Get in touch <ArrowUpRight className="!h-5 !w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto rounded-full text-base shadow-none"
            >
              <CirclePlay className="!h-5 !w-5" /> Watch our presentation
            </Button>
          </div>
        </div>
        <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square">
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
