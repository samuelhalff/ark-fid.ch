import TranslatedText from "@/src/components/ui/translated-text";

const TaxesHero = () => {
  return (
    <section className="w-full py-16 md:py-24 lg:py-32 bg-linear-to-b from-primary/10 to-background">
      <div className="container px-4 mx-auto flex flex-col items-center text-center">
        <span className="inline-block mb-4 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs tracking-widest uppercase">
          <TranslatedText
            translationKey={"Taxes.Hero.Badge"}
            fallbackText={"Badge"}
          />
        </span>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-3xl">
          <TranslatedText
            translationKey={"Taxes.Hero.Title"}
            fallbackText={"Title"}
          />
        </h1>
        <p className="text-lg md:text-2xl text-muted-foreground mb-8 max-w-2xl">
          <TranslatedText
            translationKey={"Taxes.Hero.Description"}
            fallbackText={"Description"}
          />
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
            <TranslatedText
              translationKey={"Taxes.Hero.CTA"}
              fallbackText={"Contact"}
            />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TaxesHero;
