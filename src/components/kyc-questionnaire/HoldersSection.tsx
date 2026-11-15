"use client";

import { CaretLeft, CaretRight, Check, Plus, Trash, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form";
import { getField, getGroup, label, newRowId, pruneHidden, validateAll } from "@/src/lib/kyc-questionnaire/engine";
import {
  childrenOf,
  computedPeople,
  formatPercent,
  HOLDER_DEPTH,
  holderTitle,
  holdersAt,
  idList,
  KIND_LABEL,
  listFieldName,
  NESTED,
  parsePercent,
  personById,
  personName,
  personsOf,
  prunePeople,
  rowAt,
  showsComputedLine,
  stakesText,
  withHoldersAt,
  type HolderKind,
} from "@/src/lib/kyc-questionnaire/holders";
import { personChoices, personSheetFacts, rowFromPerson, type PersonChoice } from "@/src/lib/kyc-questionnaire/people";
import { clientName, isOp, needsManager } from "@/src/lib/kyc-questionnaire/schema";
import { FIELD_ERRORS, UI } from "@/src/lib/kyc-questionnaire/ui";
import type { Answers, FieldDef, GroupDef, KycLocale, Row } from "@/src/lib/kyc-questionnaire/types";
import { cn } from "@/src/lib/utils";
import { BottomSheet } from "@/src/components/questionnaire/BottomSheet";
import { CompanyNameInput, type RegisterCompany } from "@/src/components/questionnaire/CompanyNameInput";
import { api } from "./api";
import { FieldControl } from "@/src/components/questionnaire/FieldControl";
import { fromForm, toName } from "./form-model";
import { useSubScreen } from "@/src/components/questionnaire/SubScreen";

/** The register search behind the company name (stable: the field searches again when it changes). */
const searchRegister = (q: string) => api.caseAction<{ items?: RegisterCompany[] }>("companies", { q });

type Purpose = "holder" | "control" | "managers";
type SheetState =
  | { kind: "add"; path: string[]; more: boolean }
  | { kind: "pick"; path: string[]; purpose: Purpose }
  | { kind: "holder"; path: string[]; id: string; isNew: boolean; facts: string[] }
  | { kind: "person"; personId: string; isNew: boolean; facts: string[]; purpose: "control" | "managers" };

const PERSON_LIST: Record<"control" | "managers", string> = { control: "b.controlPersons", managers: "b.managers" };
const SWISS = /^(suisse|switzerland|schweiz|svizzera)$/i;

/** Field definitions of the holders at a level (1 = the client's own holders). */
function levelGroup(top: GroupDef, depth: number): GroupDef {
  let group = top;
  for (let d = 1; d < depth && group.nested; d++) group = group.nested;
  return group;
}

/**
 * Section B of a company: who holds it (persons, companies, trusts, foundations, nominees, three
 * levels deep), the people the shares lead to (computed, shown only when it adds someone held
 * through a company), « Je ne sais pas qui est derrière » at each level, control by other means
 * asked once and, failing anyone, the senior managers picked among the directors.
 */
export function HoldersSection({ group, locale, answers }: { group: GroupDef; locale: KycLocale; answers: Answers }) {
  const { getValues, setValue, trigger, formState, getFieldState } = useFormContext();
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);
  const { set: setSubScreen } = useSubScreen();
  const [path, setPath] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const persons = getGroup("b.persons")!;
  const operating = isOp(answers);

  useEffect(() => {
    setSubScreen(path.length > 0);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [path.length, setSubScreen]);
  useEffect(() => () => setSubScreen(false), [setSubScreen]);
  // The company on screen is gone (removed, or the form reloaded): back to the client's own holders.
  useEffect(() => {
    if (path.length && !rowAt(answers, path)) setPath([]);
  }, [answers, path]);
  // Names taken from the register in this visit: their UID says so (« Ark complète depuis le registre »).
  const [fromRegister, setFromRegister] = useState<Set<string>>(() => new Set());

  // Keys of what is still missing, to mark a holder « À compléter » (same validator as sending).
  const missing = useMemo(() => Object.keys(validateAll(pruneHidden(answers))), [answers]);

  const fresh = (): Answers => ({ ...fromForm(getValues()), route: answers.route });
  const commit = (next: Answers, ids: string[]) => {
    for (const id of ids) setValue(toName(id), next[id], { shouldDirty: true });
  };
  /** Writes the holders and persons after a change; persons nothing points to any more go. */
  const commitTree = (next: Answers) => commit(prunePeople(next), ["b.holders", "b.persons", "b.controlPersons", "b.managers"]);

  const keyOf = (p: string[]) => p.reduce((key, id) => `${key}[${id}].${NESTED}`, "b.holders");
  const incomplete = (p: string[], row: Row) =>
    missing.some((k) => k.startsWith(`${keyOf(p)}[${row._id}]`)) || (row.kind === "person" && missing.some((k) => k.startsWith(`b.persons[${row.person}]`)));

  // ---- changes -------------------------------------------------------------------------------------

  const addHolder = (p: string[], row: Row, base: Answers = fresh()) => {
    const next = withHoldersAt(base, p, [...holdersAt(base, p), row]);
    commitTree(next);
    return next;
  };
  const removeHolder = (p: string[], id: string) => {
    const a = fresh();
    commitTree(withHoldersAt(a, p, holdersAt(a, p).filter((r) => r._id !== id)));
  };
  /** The `b.persons` id of a choice, creating the person (copied from earlier in the form, or blank). */
  const personFor = (choice: PersonChoice | null, a: Answers): { a: Answers; id: string } => {
    if (choice?.id) return { a, id: choice.id };
    const row = choice?.known ? rowFromPerson(persons, choice.known, { _id: newRowId() }) : { _id: newRowId() };
    return { a: { ...a, "b.persons": [...personsOf(a), row] }, id: row._id };
  };
  const pick = (target: Extract<SheetState, { kind: "pick" }>, choice: PersonChoice | null) => {
    const { a, id } = personFor(choice, fresh());
    const facts = personSheetFacts(persons, a, personById(a, id), true);
    if (target.purpose === "holder") {
      const holderId = newRowId();
      addHolder(target.path, { _id: holderId, kind: "person", person: id }, a);
      setSheet({ kind: "holder", path: target.path, id: holderId, isNew: true, facts });
      return;
    }
    const listId = PERSON_LIST[target.purpose];
    const next = { ...a, [listId]: [...new Set([...idList(a[listId]), id])] };
    commit(next, ["b.persons", listId]);
    setSheet(facts.length ? { kind: "person", personId: id, isNew: true, facts, purpose: target.purpose } : null);
  };

  // ---- pieces --------------------------------------------------------------------------------------

  const list = (p: string[]) => {
    const rows = holdersAt(answers, p);
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-surface-warm dark:bg-card">
        {rows.map((row) => {
          const kind = KIND_LABEL[row.kind as HolderKind];
          const children = childrenOf(row).length;
          const title = holderTitle(answers, row) || UI.holdersNoName[locale];
          const percent = parsePercent(row.percent);
          const chip = [kind ? L(kind) : "", row.kind === "company" && children ? (children === 1 ? UI.holdersCountOne : UI.holdersCountMany)[locale].replace("{n}", String(children)) : ""].filter(Boolean).join(" · ");
          return (
            <button
              key={row._id}
              type="button"
              className="flex min-h-14 w-full min-w-0 items-center gap-3 border-b border-border/60 py-2 pr-2 pl-3.5 text-left last:border-b-0 hover:bg-foreground/[0.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={UI.holdersOpen[locale].replace("{name}", title)}
              onClick={() => {
                if (row.kind === "company") setPath([...p, row._id]);
                else setSheet({ kind: "holder", path: p, id: row._id, isNew: false, facts: row.kind === "person" ? personSheetFacts(persons, answers, personById(answers, row.person), false) : [] });
              }}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold">{title}</span>
                <span className="flex flex-wrap gap-1.5">
                  {chip ? <Badge variant="secondary" className="font-normal">{chip}</Badge> : null}
                  {incomplete(p, row) ? <Badge variant="outline" className="font-normal text-brand-hover">{UI.holdersToComplete[locale]}</Badge> : null}
                </span>
              </span>
              <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">{percent === null ? String(row.percent || "") : formatPercent(percent, locale)}</span>
              <CaretRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
        <Button type="button" variant="ghost" className={cn("h-12 justify-start gap-2 rounded-none px-3.5 font-semibold text-brand-hover hover:text-brand-hover", rows.length && "border-t border-border/60")} onClick={() => setSheet({ kind: "add", path: p, more: false })}>
          <Plus className="size-5" />
          {UI.holdersAdd[locale]}
        </Button>
      </div>
    );
  };

  /** « Je ne sais pas qui est derrière »: a quiet toggle, at every level. */
  const unknownToggle = (on: boolean, toggle: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-sm text-left text-sm text-brand-hover underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={toggle}
    >
      {on ? <Check className="size-4 shrink-0" /> : null}
      {on ? UI.holdersUnknownSet[locale] : UI.holdersUnknown[locale]}
    </button>
  );

  const errorOf = (name: string) => getFieldState(name, formState).error?.message;

  const personsPick = (purpose: "control" | "managers") => {
    const id = PERSON_LIST[purpose];
    const field = getField(id)!;
    const chosen = idList(answers[id]);
    const name = toName(id);
    const error = errorOf(name);
    return (
      <div data-field={name} tabIndex={-1} className="flex min-w-0 flex-col gap-2 outline-none">
        <p className="form-label leading-snug font-medium">{L(field.label)}</p>
        {purpose === "managers" && field.help ? <p className="text-sm text-muted-foreground">{L(field.help)}</p> : null}
        {chosen.map((pid) => {
          const who = personName(personById(answers, pid)) || UI.holdersNoName[locale];
          return (
            <div key={pid} className="flex min-h-12 min-w-0 items-center gap-2 rounded-md bg-background pl-3 dark:bg-muted/40">
              <button type="button" className="min-h-11 min-w-0 flex-1 truncate text-left" onClick={() => setSheet({ kind: "person", personId: pid, isNew: false, facts: personSheetFacts(persons, answers, personById(answers, pid), false), purpose })}>
                {who}
              </button>
              <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={UI.holdersRemovePerson[locale].replace("{name}", who)} onClick={() => commit(prunePeople({ ...fresh(), [id]: chosen.filter((x) => x !== pid) }), [id, "b.persons"])}>
                <X className="size-4" />
              </Button>
            </div>
          );
        })}
        <Button type="button" variant="outline" className="min-h-11 justify-start gap-2 self-start" onClick={() => setSheet({ kind: "pick", path: [], purpose })}>
          <Plus className="size-4" />
          {(purpose === "managers" ? UI.holdersChooseDirector : UI.holdersChoosePerson)[locale]}
        </Button>
        {error ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  // ---- a company holder's own screen ------------------------------------------------------------------

  const companyScreen = (p: string[]) => {
    const row = rowAt(answers, p);
    const parent = p.slice(0, -1);
    const listName = listFieldName(answers, parent);
    const index = holdersAt(answers, parent).findIndex((r) => r._id === p.at(-1));
    if (!row || !listName || index < 0) return null;
    const depth = p.length;
    const fields = levelGroup(group, depth).fields;
    const def = (id: string) => fields.find((f) => f.id === id)!;
    const base = `${listName}.${index}`;
    const crumbs = [clientName(answers) || UI.holdersNoName[locale], ...parent.map((_, i) => holderTitle(answers, rowAt(answers, parent.slice(0, i + 1))!) || UI.holdersNoName[locale])];
    const unknown = row.unknown === "yes";
    const swiss = !String(row.country || "").trim() || SWISS.test(String(row.country).trim());
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <button type="button" className="-ml-3 flex min-h-11 min-w-0 items-center gap-1 self-start pr-2 text-brand-hover" aria-label={UI.holdersBackTo[locale].replace("{name}", crumbs.at(-1)!)} onClick={() => setPath(parent)}>
          <CaretLeft className="size-6 shrink-0" />
          <span className="truncate">{crumbs.join(" › ")} ›</span>
        </button>
        <FormField
          name={`${base}.name`}
          render={({ field: f }) => (
            <FormItem data-field={`${base}.name`} className="gap-1">
              <FormLabel className="text-xs font-normal text-muted-foreground">{UI.holdersCompanyName[locale]}</FormLabel>
              <FormControl>
                <CompanyNameInput
                  ref={f.ref}
                  name={f.name}
                  value={typeof f.value === "string" ? f.value : ""}
                  maxLength={def("name").maxLength}
                  search={swiss}
                  searchRegister={searchRegister}
                  listLabel={UI.holdersRegisterHint[locale]}
                  className="h-12 text-lg font-semibold"
                  onValue={(next) => {
                    f.onChange(next);
                    setFromRegister((known) => {
                      if (!known.has(row._id)) return known;
                      const rest = new Set(known);
                      rest.delete(row._id);
                      return rest;
                    });
                  }}
                  onBlur={f.onBlur}
                  onPick={(company) => {
                    if (company.uid) setValue(`${base}.uid`, company.uid, { shouldDirty: true });
                    if (!String(row.country || "").trim()) setValue(`${base}.country`, locale === "fr" ? "Suisse" : "Switzerland", { shouldDirty: true });
                    setFromRegister((known) => new Set(known).add(row._id));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <FieldControl field={def("country")} name={`${base}.country`} answers={answers} />
          <FieldControl field={def("percent")} name={`${base}.percent`} answers={answers} />
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
            <FieldControl field={def("uid")} name={`${base}.uid`} answers={answers} />
            {fromRegister.has(row._id) ? <p className="text-xs text-brand-hover">{UI.holdersFromRegister[locale]}</p> : null}
          </div>
        </div>
        {depth < HOLDER_DEPTH ? (
          <div className="flex min-w-0 flex-col gap-3">
            <h3 className="text-base font-semibold">{L(levelGroup(group, depth + 1).label)}</h3>
            {unknown ? null : list(p)}
            {!unknown && missing.includes(`${keyOf(parent)}[${row._id}].${NESTED}`) ? <p className="text-sm text-muted-foreground">{FIELD_ERRORS.min_rows[locale]}</p> : null}
          </div>
        ) : unknown ? null : (
          <FieldControl field={def("owners")} name={`${base}.owners`} answers={answers} />
        )}
        {unknownToggle(unknown, () => setValue(`${base}.unknown`, unknown ? undefined : "yes", { shouldDirty: true }))}
        <div className="flex flex-col gap-2 pt-2">
          <Button type="button" className="h-12" onClick={() => setPath(parent)}>
            {UI.holdersDone[locale]}
          </Button>
          <Button type="button" variant="ghost" className="min-h-11 gap-2 self-center text-muted-foreground" onClick={() => {
            setPath(parent);
            removeHolder(parent, row._id);
          }}>
            <Trash className="size-4" />
            {UI.holdersRemove[locale]}
          </Button>
        </div>
      </div>
    );
  };

  // ---- sheets ------------------------------------------------------------------------------------------

  const sheetBody = (): { title: string; body: React.ReactNode; onClose: () => void } | null => {
    if (!sheet) return null;
    const close = () => setSheet(null);
    if (sheet.kind === "add") {
      const add = (kind: HolderKind) => {
        if (kind === "person") return setSheet({ kind: "pick", path: sheet.path, purpose: "holder" });
        const row: Row = { _id: newRowId(), kind };
        addHolder(sheet.path, row);
        if (kind === "company") {
          setSheet(null);
          setPath([...sheet.path, row._id]);
        } else setSheet({ kind: "holder", path: sheet.path, id: row._id, isNew: true, facts: [] });
      };
      const choice = (kind: HolderKind, big: boolean) => (
        <Button key={kind} type="button" variant="outline" className={cn("w-full font-semibold", big ? "h-16 text-base" : "h-12")} onClick={() => add(kind)}>
          {L(KIND_LABEL[kind])}
        </Button>
      );
      return {
        title: UI.holdersAdd[locale],
        onClose: close,
        body: (
          <>
            <div className="grid grid-cols-2 gap-3">{(["person", "company"] as HolderKind[]).map((k) => choice(k, true))}</div>
            {sheet.more ? (
              <div className="grid gap-2 sm:grid-cols-3">{(["trust", "foundation", "nominee"] as HolderKind[]).map((k) => choice(k, false))}</div>
            ) : (
              <button type="button" className="inline-flex min-h-11 items-center self-start rounded-sm text-sm text-brand-hover underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" onClick={() => setSheet({ ...sheet, more: true })}>
                {UI.holdersOtherKinds[locale]}
              </button>
            )}
          </>
        ),
      };
    }
    if (sheet.kind === "pick") {
      const exclude = sheet.purpose === "holder" ? holdersAt(answers, sheet.path).map((r) => String(r.person || "")) : idList(answers[PERSON_LIST[sheet.purpose]]);
      const choices = personChoices(answers, { directorsOnly: sheet.purpose === "managers", exclude });
      const hint = (c: PersonChoice) => {
        const role = c.role || (c.known?.contact ? UI.contactRole[locale] : "");
        return c.known ? UI.holdersGivenAbove[locale].replace("{role}", role ? `${role}, ` : "") : role;
      };
      return {
        title: UI.holdersWhichPerson[locale],
        onClose: close,
        body: (
          <div className="flex flex-col gap-2">
            {choices.map((c) => (
              <Button key={c.id || c.known?.key} type="button" variant="outline" className="h-auto min-h-13 flex-col items-start justify-center gap-0 py-2 text-left whitespace-normal" onClick={() => pick(sheet, c)}>
                <span className="font-semibold [overflow-wrap:anywhere]">{c.name}</span>
                {hint(c) ? <span className="text-sm font-normal text-muted-foreground">{hint(c)}</span> : null}
              </Button>
            ))}
            {(
              <Button type="button" variant="outline" className="h-13 justify-start font-semibold" onClick={() => pick(sheet, null)}>
                {UI.holdersSomeoneElse[locale]}
              </Button>
            )}
          </div>
        ),
      };
    }
    const a = answers;
    const personIndex = (pid: unknown) => personsOf(a).findIndex((p) => p._id === pid);
    const factFields = (pid: unknown, facts: string[]): { def: FieldDef; name: string }[] => {
      const pi = personIndex(pid);
      return pi < 0 ? [] : persons.fields.filter((f) => facts.includes(f.id)).map((def) => ({ def, name: `b__persons.${pi}.${def.id}` }));
    };
    /** « Ajouter » / « Valider »: closes once the answers of the panel are accepted. */
    const done = async (names: string[]) => {
      if (names.length && !(await trigger(names))) return;
      setSheet(null);
    };
    if (sheet.kind === "person") {
      const items = factFields(sheet.personId, sheet.facts);
      const listId = PERSON_LIST[sheet.purpose];
      return {
        title: (sheet.facts.includes("lastName") || sheet.facts.includes("firstName") ? "" : personName(personById(a, sheet.personId))) || UI.holdersNewPerson[locale],
        onClose: () => {
          if (sheet.isNew) commit(prunePeople({ ...fresh(), [listId]: idList(fresh()[listId]).filter((x) => x !== sheet.personId) }), [listId, "b.persons"]);
          close();
        },
        body: (
          <>
            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              {items.map(({ def, name }) => (
                <FieldControl key={name} field={def} name={name} answers={a} />
              ))}
            </div>
            <Button type="button" className="h-12" onClick={() => void done(items.map((i) => i.name))}>
              {(sheet.isNew ? UI.holdersAddButton : UI.rowDone)[locale]}
            </Button>
          </>
        ),
      };
    }
    // A holder that is not a company: a person (share and missing facts) or a trust, foundation, nominee.
    const listName = listFieldName(a, sheet.path);
    const index = holdersAt(a, sheet.path).findIndex((r) => r._id === sheet.id);
    const row = holdersAt(a, sheet.path)[index];
    if (!row || !listName) return null;
    const fields = levelGroup(group, sheet.path.length + 1).fields;
    const base = `${listName}.${index}`;
    const own = (ids: string[]) => ids.map((id) => ({ def: fields.find((f) => f.id === id)!, name: `${base}.${id}` }));
    const items = row.kind === "person" ? [...factFields(row.person, sheet.facts.filter((id) => id === "lastName" || id === "firstName")), ...own(["percent"]), ...factFields(row.person, sheet.facts.filter((id) => id !== "lastName" && id !== "firstName"))] : own(["name", "percent", "behind"]);
    // The name is the title unless it is being typed in this very panel (it would say it twice).
    const typingName = sheet.facts.includes("lastName") || sheet.facts.includes("firstName");
    const title = row.kind === "person" ? (typingName ? "" : personName(personById(a, row.person))) || UI.holdersNewPerson[locale] : L(KIND_LABEL[row.kind as HolderKind] || KIND_LABEL.trust);
    return {
      title,
      onClose: () => {
        if (sheet.isNew) removeHolder(sheet.path, sheet.id);
        close();
      },
      body: (
        <>
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            {items.map(({ def, name }) => (
              <FieldControl key={name} field={def} name={name} answers={a} />
            ))}
          </div>
          {row.kind === "trust" || row.kind === "foundation" ? <p className="text-sm text-muted-foreground">{UI.holdersTrustNote[locale]}</p> : null}
          <div className="flex flex-col gap-2">
            <Button type="button" className="h-12" onClick={() => void done(items.map((i) => i.name))}>
              {(sheet.isNew ? UI.holdersAddButton : UI.rowDone)[locale]}
            </Button>
            {sheet.isNew ? null : (
              <Button type="button" variant="ghost" className="min-h-11 gap-2 self-center text-muted-foreground" onClick={() => {
                removeHolder(sheet.path, sheet.id);
                close();
              }}>
                <Trash className="size-4" />
                {UI.holdersRemove[locale]}
              </Button>
            )}
          </div>
        </>
      ),
    };
  };
  const open = sheetBody();

  // ---- the client's own holders ------------------------------------------------------------------------

  const groupError = errorOf(toName(group.id));
  const unknownTop = answers["b.holdersUnknown"] === "yes";
  const computed = computedPeople(answers, operating);
  return (
    <div ref={top} data-field={toName(group.id)} tabIndex={-1} className="flex min-w-0 scroll-mt-32 flex-col gap-4 outline-none" aria-label={L(group.label)}>
      {path.length ? (
        companyScreen(path)
      ) : (
        <>
          {list([])}
          {groupError ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {groupError}
            </p>
          ) : null}
          {showsComputedLine(answers, operating) ? (
            <p className="text-sm text-muted-foreground">
              {(operating ? UI.holdersComputedOp : UI.holdersComputedNonOp)[locale]}
              {locale === "fr" ? " : " : ": "}
              <span className="font-medium text-foreground">{stakesText(answers, computed, locale)}</span>
            </p>
          ) : null}
          {unknownToggle(unknownTop, () => setValue(toName("b.holdersUnknown"), unknownTop ? undefined : "yes", { shouldDirty: true }))}
          {operating && getField("b.qOther") && (!getField("b.qOther")!.showIf || getField("b.qOther")!.showIf!(answers)) ? (
            <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-surface-warm p-4 dark:bg-card">
              <FieldControl field={getField("b.qOther")!} name={toName("b.qOther")} answers={answers} />
              {answers["b.qOther"] === "yes" ? (
                <>
                  {personsPick("control")}
                  <FieldControl field={getField("b.controlHow")!} name={toName("b.controlHow")} answers={answers} />
                </>
              ) : null}
            </div>
          ) : null}
          {needsManager(answers) ? <div className="rounded-xl bg-surface-warm p-4 dark:bg-card">{personsPick("managers")}</div> : null}
        </>
      )}
      <BottomSheet open={!!open} title={open?.title || ""} closeLabel={UI.holdersClose[locale]} onClose={open?.onClose || (() => setSheet(null))}>
        {open?.body}
      </BottomSheet>
    </div>
  );
}
