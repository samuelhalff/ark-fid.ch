import React from "react";
const ScaleIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3v3" /><path d="M6 7h12" /><path d="M6 7l-3 6h6l-3-6z" /><path d="M18 7l-3 6h6l-3-6z" /><path d="M12 10v11" />
  </svg>
);
const ShieldIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const TrendingUpIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 17l6-6 4 4 7-7" /><path d="M14 7h7v7" />
  </svg>
);
const FileCheckIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 15l2 2 4-4" />
  </svg>
);

interface ServiceArea {
  title: string;
  description: string;
}

interface ServiceAreasGridProps {
  serviceAreas: ServiceArea[];
}

const ServiceAreasGrid = ({ serviceAreas }: ServiceAreasGridProps) => {
  const icons = [ScaleIcon, ShieldIcon, TrendingUpIcon, FileCheckIcon];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {serviceAreas.map((area, index) => {
        const Icon = icons[index] || FileCheckIcon;

        return (
          <div
            key={index}
            className="rounded-xl bg-white p-6 shadow-md transition-colors duration-200 hover:bg-surface-warm dark:bg-gray-800 dark:hover:bg-card"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-primary-50 dark:bg-gray-900/20 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-600 dark:text-grey-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold leading-tight text-gray-900 dark:text-white">
                {area.title}
              </h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {area.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default ServiceAreasGrid;
