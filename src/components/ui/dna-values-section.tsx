import React from "react";
const AwardIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="8" r="5" />
    <path d="M8 13l-2 7 6-3 6 3-2-7" />
  </svg>
);
const UsersIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const LightbulbIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M2 10a10 10 0 1 1 20 0c0 4-3 6-5 7H7c-2-1-5-3-5-7z" />
  </svg>
);
const HandshakeIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 13.5l2.5 2.5a2 2 0 0 0 2.8 0l3.2-3.2a2 2 0 0 0 0-2.8L18.5 8.5" />
    <path d="M12 13.5l-2.5 2.5a2 2 0 0 1-2.8 0L3.5 12.8a2 2 0 0 1 0-2.8L7 6.5" />
    <path d="M7 6.5l5 5 6.5-6.5" />
    <path d="M9.5 14.5l2 2" />
  </svg>
);

const iconMap = [AwardIcon, UsersIcon, LightbulbIcon, HandshakeIcon];

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
