"use client";

import { CaretUpDown, Check } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/src/components/ui/command";
import { Input } from "@/src/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { searchCommunes } from "@/src/lib/tax-questionnaire/communes";
import type { QfLocale } from "@/src/lib/tax-questionnaire/types";
import { cn } from "@/src/lib/utils";

const T = {
  placeholder: { fr: "Choisir une commune…", en: "Choose a municipality…", de: "Gemeinde wählen…" },
  search: { fr: "Rechercher une commune", en: "Search a municipality", de: "Gemeinde suchen" },
  empty: { fr: "Aucune commune trouvée.", en: "No municipality found.", de: "Keine Gemeinde gefunden." },
  notListed: { fr: "Ma commune n'est pas dans la liste", en: "My municipality is not in the list", de: "Meine Gemeinde ist nicht in der Liste" },
  backToList: { fr: "Choisir dans la liste", en: "Choose from the list", de: "Aus der Liste wählen" },
  typeIt: { fr: "Nom de la commune", en: "Municipality name", de: "Name der Gemeinde" },
} as const;

interface Props {
  id?: string;
  value: string;
  bfs: string;
  canton?: string;
  locale: QfLocale;
  invalid?: boolean;
  describedBy?: string;
  onChange: (value: { name: string; bfs: string }) => void;
  onBlur?: () => void;
}

/**
 * Swiss commune picker: shadcn Combobox (Popover + Command) over the official BFS list, filtered by
 * the canton chosen above; "not in the list" switches to free text (no BFS number).
 */
export function CommuneField({ id, value, bfs, canton, locale, invalid, describedBy, onChange, onBlur }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(!!value && !bfs);
  const results = useMemo(() => searchCommunes(query, canton, 60), [query, canton]);
  const showCanton = !canton || canton === "ABROAD";

  if (manual) {
    return (
      <div className="flex flex-col gap-1">
        <Input
          id={id}
          value={value}
          maxLength={120}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder={T.typeIt[locale]}
          onChange={(e) => onChange({ name: e.target.value, bfs: "" })}
          onBlur={onBlur}
        />
        <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => { setManual(false); onChange({ name: "", bfs: "" }); }}>
          {T.backToList[locale]}
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) onBlur?.(); }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn("h-10 w-full justify-between px-3 font-normal", !value && "text-muted-foreground", invalid && "ring-2 ring-destructive/50")}
        >
          <span className="truncate">{value || T.placeholder[locale]}</span>
          <CaretUpDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={T.search[locale]} value={query} onValueChange={setQuery} aria-label={T.search[locale]} />
          <CommandList>
            <CommandEmpty>{T.empty[locale]}</CommandEmpty>
            <CommandGroup>
              {results.map((c) => (
                <CommandItem
                  key={c.bfs}
                  value={String(c.bfs)}
                  onSelect={() => {
                    onChange({ name: c.name, bfs: String(c.bfs) });
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("size-4", String(c.bfs) === bfs ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{c.name}</span>
                  {showCanton ? <span className="text-xs text-muted-foreground">{c.canton}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup>
              <CommandItem
                value="__not_listed__"
                onSelect={() => {
                  setManual(true);
                  setOpen(false);
                  onChange({ name: query, bfs: "" });
                }}
              >
                <span className="text-sm">{T.notListed[locale]}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
