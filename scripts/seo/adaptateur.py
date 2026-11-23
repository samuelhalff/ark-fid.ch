"""Adaptateur ark-fid.ch du SEO mensuel (scripts/seo/seo_mensuel.py).

Pages modifiables :
  - articles : src/translations/<locale>/ressources.json, Articles[slug] ; titre et description dans metaTitle /
    metaDescription (repris tels quels par src/lib/metadata.ts) ; FAQ dans la section « ## FAQ / Questions
    fréquentes » du contenu (blocs « ### question ? »), lue par src/lib/articleFaq.ts pour la FAQ visible et le JSON-LD.
    Les articles sont rédigés par langue : une question ajoutée ne concerne que la langue de la page.
  - pages de services et pages institutionnelles : src/translations/<locale>/metadata.json, pages["<chemin anglais>"]
    (suffixe « | Ark Fiduciaire » gardé) ; FAQ dans <ns>.json « Faq.Questions » (src/lib/page-faq.ts, même source pour
    la FAQ visible et le JSON-LD), ajoutée dans les cinq langues, 6 questions au plus (src/lib/faq.test.ts).
Jamais touchées : légal, confidentialité, cookies, KYC, questionnaire fiscal, contact, agent, ai-profile ; les titres
imposés par scripts/seo-geo-check.js (FR et EN) ; aucun prix ni montant (motifs interdits ci-dessous).
Sujets sans page adaptée : docs/seo-sujets.md (le pipeline d'articles n'a pas de file de sujets).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TR = ROOT / "src" / "translations"

NOM = "ark-fid.ch (Ark Fiduciaire, fiduciaire à Genève)"
PROPRIETE = "sc-domain:ark-fid.ch"
HOTE = "ark-fid.ch"
BASE_URL = "https://ark-fid.ch"
BOT = "ark-seo-bot"
DEPLOIEMENT_LLM = "gpt-4.1"
VERSION_API_LLM = "2024-05-01-preview"
APOSTROPHE_COURBE = False
MARQUE = r"\bark\b|ark.?fid|ridger"
LOCALES = ["fr", "en", "de", "es", "pt"]
THEME = ("fiduciaire en Suisse romande pour PME, entrepreneurs et familles : comptabilité, fiscalité, salaires, "
         "création de sociétés, domiciliation, services corporate, fusions et acquisitions, Odoo, family office, "
         "immigration, droit des sociétés suisse et actualité économique romande")
REGLES_SITE = ("fiduciaire genevoise, ton simple, professionnel et humain, sans majuscules inutiles ni ton publicitaire ; "
               "aucun prix, tarif ni montant ; aucun chiffre, client ou cas pratique inventé ; prudence juridique : si le "
               "droit n'est pas clair, donner la lecture prudente sans la présenter comme la loi ; ne pas parler du KYC ni "
               "du questionnaire fiscal ; pas de promesse de résultat ; la marque s'écrit « Ark Fiduciaire ».")
INTERDITS = [
    (r"\bCHF\b|\bfrancs?\b|\bFr\.\s?\d|€|\bEUR\b", "prix ou montant"),
    (r"\bKYC\b", "KYC (hors champ)"),
    (r"\bgaranti\w*|\bguarantee\w*|\bgarantiert\w*", "garantie"),
    (r"\bmeilleur\w*|\bn[°o]\s?1\b|\bleader\b|\bbest\b|\bbeste\w*|\bmejor\w*|\bmelhor\w*", "superlatif"),
    (r"\bgratuit\w*|\bfree of charge\b|\bkostenlos\w*", "gratuit"),
]
# Titres imposés par scripts/seo-geo-check.js : pas de réécriture automatique en FR et EN.
VERROUILLES = {"/", "/services", "/services/accounting", "/services/taxes", "/services/payroll",
               "/services/domiciliation", "/services/incorporation", "/services/odoo", "/services/family-office"}
BASE_NS = {
    "/": "home", "/services": "services", "/about": "about-us", "/partners": "partners", "/team": "team",
    "/services/accounting": "accounting", "/services/corporate": "corporate",
    "/services/domiciliation": "domiciliation", "/services/family-office": "family-office",
    "/services/immigration": "immigration", "/services/incorporation": "incorporation",
    "/services/mergers-acquisitions": "mna", "/services/odoo": "odoo", "/services/outsourcing": "outsourcing",
    "/services/payroll": "payroll", "/services/taxes": "taxes",
}
FR_SLUGS = {"/services/accounting": "/services/comptabilite", "/services/taxes": "/services/fiscalite",
            "/services/payroll": "/services/paie", "/services/outsourcing": "/services/externalisation",
            "/services/mergers-acquisitions": "/services/fusions-acquisitions",
            "/services/corporate": "/services/services-corporatifs",
            "/services/incorporation": "/services/constitution-entreprise"}  # src/lib/paths.ts frMap
SUFFIXE = " | Ark Fiduciaire"
FAQ_TITRE = re.compile(r"^##\s+(?:FAQ\b|Questions fréquentes|Frequently asked questions|Häufige Fragen|"
                       r"Preguntas frecuentes|Perguntas frequentes)", re.I)  # = src/lib/articleFaq.ts
SUJETS = ROOT / "docs" / "seo-sujets.md"
DEST_SUJETS = "docs/seo-sujets.md, le pipeline d'articles n'ayant pas de file de sujets"


def lire(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def ecrire(p: Path, d: dict) -> None:
    s = p.read_text(encoding="utf-8")
    m = re.search(r"\n( +)\S", s)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=len(m.group(1)) if m else 2)
                 + ("\n" if s.endswith("\n") else ""), encoding="utf-8")


def chaines(x) -> list[str]:
    if isinstance(x, str):
        return [x]
    if isinstance(x, dict):
        return [s for v in x.values() for s in chaines(v)]
    if isinstance(x, list):
        return [s for v in x for s in chaines(v)]
    return []


def strip_md(v: str) -> str:
    v = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", v)
    v = re.sub(r"[*_`>]", "", v)
    v = re.sub(r"^\s*[-•]\s+", "", v, flags=re.M)
    return re.sub(r"\s+", " ", v).strip()


def faq_article(content: str) -> list[dict]:
    lignes = content.split("\n")
    debut = next((i for i, ln in enumerate(lignes) if FAQ_TITRE.match(ln)), -1)
    if debut < 0:
        return []
    out, q, rep = [], "", []
    for ln in lignes[debut + 1:] + ["## fin"]:
        if re.match(r"^##\s", ln) or re.match(r"^---\s*$", ln) or re.match(r"^###\s+", ln):
            if q and strip_md(" ".join(rep)) and re.search(r"[?？]\s*$", q):
                out.append({"q": q, "a": strip_md(" ".join(rep))})
            q, rep = "", []
            if not re.match(r"^###\s+", ln):
                break
            q = strip_md(re.sub(r"^\d+\.\s*", "", ln[4:].strip()))
        elif q:
            rep.append(ln)
    return out


class Page:
    suffixe = ""
    meta_ok = True
    faq_max = 6

    def __init__(self, **kw):
        self.soeurs: dict[str, Page] = {}
        self.__dict__.update(kw)

    def texte(self) -> str:
        return self._texte()


def pages() -> dict[str, Page]:
    out: dict[str, Page] = {}
    fr_articles = {a["slug"]: a for a in lire(TR / "fr" / "ressources.json")["Articles"]}
    for loc in LOCALES:
        meta = lire(TR / loc / "metadata.json")
        dyn = meta.get("dynamic", {}).get("articles", {})
        # --- articles
        f = TR / loc / "ressources.json"
        for a in lire(f)["Articles"]:
            if not a.get("slug") or not a.get("content"):
                continue
            fr = fr_articles.get(a["slug"])
            langue = "fr" if loc != "fr" and fr and fr.get("title") == a.get("title") else loc
            t = a.get("title", "")
            tpl = dyn.get("titleTemplate", "{articleTitle}").replace("{articleTitle}", t)
            titre = a.get("metaTitle") or (tpl if len(tpl) <= 60 else f"{t}{SUFFIXE}" if len(t + SUFFIXE) <= 60 else t)
            dtpl = dyn.get("descriptionTemplate", "{articleDescription}").replace("{articleDescription}",
                                                                                  a.get("description", ""))
            desc = a.get("metaDescription") or (dtpl if len(dtpl) <= 155 else a.get("description", ""))
            faq = faq_article(a["content"])
            url = f"/{loc}/ressources/articles/{a['slug']}/"
            out[url] = Page(url=url, locale=langue, fichier=str(f.relative_to(ROOT)), kind="article", path=f,
                            slug=a["slug"], title=titre, description=desc, faq=faq if faq else None, faq_max=12,
                            _texte=lambda a=a: f"{a.get('title', '')}\n{a.get('description', '')}\n{a['content']}")
        # --- pages de services et institutionnelles
        for base, ns in BASE_NS.items():
            nsf = TR / loc / f"{ns}.json"
            m = meta.get("pages", {}).get(base)
            if not nsf.exists() or not m:
                continue
            data = lire(nsf)
            chemin = FR_SLUGS.get(base, base) if loc == "fr" else base
            url = f"/{loc}/" if chemin == "/" else f"/{loc}{chemin}/"
            faq = None
            if isinstance(data.get("Faq"), dict) and isinstance(data["Faq"].get("Questions"), list) and base != "/":
                faq = [{"q": x["Question"], "a": x["Answer"]} for x in data["Faq"]["Questions"]]
            out[url] = Page(url=url, locale=loc, fichier=str((TR / loc / "metadata.json").relative_to(ROOT)),
                            kind="page", path=nsf, base=base, ns=ns, meta_path=TR / loc / "metadata.json",
                            title=m.get("title", ""), description=m.get("description", ""),
                            suffixe=SUFFIXE if m.get("title", "").endswith(SUFFIXE) else "",
                            meta_ok=not (loc in ("fr", "en") and base in VERROUILLES), faq=faq,
                            _texte=lambda data=data, m=m: "\n".join([m.get("title", ""), m.get("description", "")]
                                                                     + chaines({k: v for k, v in data.items()})))
    # FAQ des pages : dans les cinq langues ou pas du tout
    par_ns: dict[str, dict[str, Page]] = {}
    for p in out.values():
        if p.kind == "page" and p.faq is not None:
            par_ns.setdefault(p.ns, {})[p.locale] = p
    for groupe in par_ns.values():
        for loc, p in groupe.items():
            p.soeurs = {l: q for l, q in groupe.items() if l != loc}
    return out


def ecrire_meta(page: Page, title: str, description: str) -> list[Path]:
    if page.kind == "page":
        d = lire(page.meta_path)
        d["pages"][page.base]["title"] = title
        d["pages"][page.base]["description"] = description
        ecrire(page.meta_path, d)
        return [page.meta_path]
    d = lire(page.path)
    for i, a in enumerate(d["Articles"]):
        if a.get("slug") == page.slug and "metaTitle" in a:  # clé existante : modifiée sur place
            a["metaTitle"], a["metaDescription"] = title, description
        elif a.get("slug") == page.slug:
            nouveau = {}
            for k, v in a.items():
                if k in ("metaTitle", "metaDescription"):
                    continue
                nouveau[k] = v
                if k == "description":
                    nouveau["metaTitle"], nouveau["metaDescription"] = title, description
            nouveau.setdefault("metaTitle", title)
            nouveau.setdefault("metaDescription", description)
            d["Articles"][i] = nouveau
    ecrire(page.path, d)
    return [page.path]


def ajouter_faq(page: Page, q: str, a: str) -> list[Path]:
    d = lire(page.path)
    if page.kind == "page":
        d["Faq"]["Questions"].append({"Question": q, "Answer": a})
        ecrire(page.path, d)
        return [page.path]
    for art in d["Articles"]:
        if art.get("slug") != page.slug:
            continue
        lignes = art["content"].split("\n")
        debut = next(i for i, ln in enumerate(lignes) if FAQ_TITRE.match(ln))
        fin = len(lignes)
        dernier = None
        for i in range(debut + 1, len(lignes)):
            ln = lignes[i]
            if re.match(r"^##\s", ln) or re.match(r"^---\s*$", ln):
                fin = i
                break
            if re.match(r"^###\s+.*[?？]\s*$", ln):
                dernier = i
        # après la réponse de la dernière question (avant un éventuel « ### Services liés »)
        j = fin
        if dernier is not None:
            j = next((i for i in range(dernier + 1, fin) if re.match(r"^###\s", lignes[i])), fin)
        while j > debut + 1 and lignes[j - 1].strip() == "":
            j -= 1
        lignes[j:j] = ["", f"### {q}", "", a]
        art["content"] = "\n".join(lignes)
    ecrire(page.path, d)
    return [page.path]


def ajouter_sujets(sujets: list[dict]) -> tuple[list[Path], list[Path]]:
    nouveau = not SUJETS.exists()
    tete = ("# Sujets d'articles tirés de la Search Console\n\n"
            "Tenu par le SEO mensuel (`scripts/seo/seo_mensuel.py`, workflow `seo-mensuel.yml`) : recherches Google qui "
            "donnent des impressions à ark-fid.ch sans qu'aucune page n'y réponde bien (position moyenne au-delà de 20). "
            "Le pipeline d'articles (`ai-ressources-twice-monthly.yml`) n'a pas de file de sujets ; une ligne peut lui "
            "être donnée par son entrée `force_topic`.\n")
    s = tete if nouveau else SUJETS.read_text(encoding="utf-8").rstrip("\n") + "\n"
    s += (f"\n## {sujets[0]['ajoute']}\n\n| Requête | Impressions (28 j) | Position | Article possible |\n"
          "|---|---|---|---|\n")
    for x in sujets:
        s += f"| {x['requete']} | {x['impressions']} | {str(x['position']).replace('.', ',')} | {x['angle']} |\n"
    SUJETS.write_text(s, encoding="utf-8")
    return [SUJETS], ([SUJETS] if nouveau else [])


CONTROLES = [
    ("Lint", "npm run lint", "."),
    ("Tests (types, indexabilité, liens, garde-fous)", "npm test", "."),
    ("FAQ (texte visible = JSON-LD, typographie)",
     "npx --yes node@22 --import ./scripts/ts-relative-resolve.mjs --test src/lib/faq.test.ts", "."),
    ("Traductions", "npm run validate:translations", "."),
    ("Liens internes des articles", "node scripts/fix-article-internal-links.js --check", "."),
    ("Build", "npm run build", "."),
]


def deployer(log) -> str:
    log("le push (jeton PAT_TOKEN du checkout) déclenche build-and-deploy.yml")
    return ("Déploiement : build-and-deploy.yml, déclenché par le push, attend la fin de ce passage (groupe "
            "production-deploy).")
PREFIXE_COMMIT = "feat(seo): "
