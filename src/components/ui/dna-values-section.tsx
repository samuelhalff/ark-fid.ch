import React from "react";
import { Award, Users, Lightbulb, Handshake } from "lucide-react";

const iconMap = [Award, Users, Lightbulb, Handshake];

export interface DNAValueItem {
  Title: string;
  Desc: string;
}

export default function DNAValuesSection({
  title,
  subtitle,
  values,
}: {
  title: string;
  subtitle: string;
  values: DNAValueItem[];
}) {
  return (
    <section>
      <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-4 md:leading-[2rem] tracking-tight">
        {title}
      </h3>
      <h4 className="text-lg font-semibold mb-8">{subtitle}</h4>
      <div className="space-y-6">
        {values.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-4 p-6 rounded-lg bg-primary/5"
          >
            {React.createElement(iconMap[index % iconMap.length], {
              className: "text-blue-400 mt-1 min-w-[24px]",
              size: 24,
            })}
            <div>
              <h5 className="font-semibold text-lg mb-2">{item.Title}</h5>
              <p className="text-base leading-relaxed">{item.Desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
