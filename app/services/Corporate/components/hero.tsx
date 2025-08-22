import TranslatedText from "@/src/components/ui/translated-text";

const CorporateHero = () => {
  return (
    <section className="w-full py-16 md:py-24 lg:py-32 bg-linear-to-b from-primary/10 to-background">
      <div className="container px-4 mx-auto flex flex-col items-center text-center">
        <span className="inline-block mb-4 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs tracking-widest uppercase">
          <TranslatedText
            translationKey={"Corporate.Hero.Badge"}
            fallbackText={"Badge"}
          />
        </span>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-3xl">
          <TranslatedText
            translationKey={"Corporate.Hero.Title"}
            fallbackText={"Title"}
          />
        </h1>
        <p className="text-lg md:text-2xl text-muted-foreground mb-8 max-w-2xl">
          <TranslatedText
            translationKey={"Corporate.Hero.Description"}
            fallbackText={"Description"}
          />
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="btn btn-primary">
            <TranslatedText
              translationKey={"Corporate.Hero.CTA"}
              fallbackText={"Contact"}
            />
          </button>
        </div>
      </div>
    </section>
  );
};

export default CorporateHero;
