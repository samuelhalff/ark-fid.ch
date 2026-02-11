import { tidyTitle } from "@/src/lib/typography";

type ServiceLongFormProps = {
  t: (key: string) => string;
  titleKey?: string;
  bodyKey?: string;
  fallbackTitle?: string;
  fallbackBody?: string[];
  className?: string;
};

const ServiceLongForm = ({
  t,
  titleKey = "Presentation.LongFormTitle",
  bodyKey = "Presentation.LongForm",
  fallbackTitle = "Detailed approach and deliverables",
  fallbackBody = [],
  className = "",
}: ServiceLongFormProps) => {
  const title = (t(titleKey) as string) || fallbackTitle;
  const body = (t(bodyKey) as unknown as string[]) || fallbackBody;

  if (!Array.isArray(body) || body.length === 0) return null;

  return (
    <section className={`space-y-6 ${className}`.trim()}>
      {title ? (
        <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-6 md:leading-[2rem] tracking-tight">
          {tidyTitle(title)}
        </h3>
      ) : null}
      <div className="space-y-6 text-base leading-relaxed">
        {body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
};

export default ServiceLongForm;
