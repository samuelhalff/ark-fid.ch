import { tidyTitle } from "@/src/lib/typography";

type ServiceLongFormProps = {
  t: (key: string) => string;
  titleKey?: string;
  bodyKey?: string;
  sectionsKey?: string;
  fallbackTitle?: string;
  fallbackBody?: string[];
  className?: string;
};

const ServiceLongForm = ({
  t,
  titleKey = "Presentation.LongFormTitle",
  bodyKey = "Presentation.LongForm",
  sectionsKey = "Presentation.LongFormSections",
  fallbackTitle = "Detailed approach and deliverables",
  fallbackBody = [],
  className = "",
}: ServiceLongFormProps) => {
  const title = (t(titleKey) as string) || fallbackTitle;
  const sections = t(sectionsKey) as unknown as Array<{
    Title?: string;
    Body?: string[];
  }>;
  const body = (t(bodyKey) as unknown as string[]) || fallbackBody;

  if (
    (!Array.isArray(sections) || sections.length === 0) &&
    (!Array.isArray(body) || body.length === 0)
  ) {
    return null;
  }

  return (
    <section className={`space-y-6 ${className}`.trim()}>
      {title ? (
        <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-6 md:leading-[2rem] tracking-tight">
          {tidyTitle(title)}
        </h3>
      ) : null}
      {Array.isArray(sections) && sections.length > 0 ? (
        <div className="space-y-10 text-base leading-relaxed">
          {sections.map((section, index) => (
            <div key={index} className="space-y-4">
              {section?.Title ? (
                <h4 className="text-lg font-semibold">
                  {tidyTitle(section.Title)}
                </h4>
              ) : null}
              {(Array.isArray(section?.Body) ? section.Body : []).map(
                (paragraph, pIndex) => (
                  <p key={pIndex}>{paragraph}</p>
                )
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6 text-base leading-relaxed">
          {body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
    </section>
  );
};

export default ServiceLongForm;
