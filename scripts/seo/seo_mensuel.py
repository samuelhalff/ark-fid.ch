#!/usr/bin/env python3
"""Amélioration SEO mensuelle, entièrement automatique (GitHub Actions, workflow seo-mensuel.yml).

Même moteur dans les trois dépôts (guide-assurance.ch, ark-fid.ch, houle-ai-website) ; ce qui est propre au site
(où sont les titres, les FAQ, les contrôles, la file de sujets, le déploiement) vit dans adaptateur.py à côté.

Déroulé :
  1. Search Console (compte de service, secret GSC_SA_JSON) : 28 derniers jours et les 28 précédents, par page,
     par requête et par requête x page.
  2. Effet des changements des passages précédents (data/seo-journal.json) : clics et CTR avant / maintenant.
  3. Pages à 100 impressions ou plus dont le CTR est faible pour leur position : titre (60 caractères au plus) et
     meta description (130 à 155) réécrits par le LLM dans la langue de la page, requête principale gardée,
     5 pages au plus.
  4. Requêtes en position 5 à 20 rattachées à une page : une question de FAQ (visible et JSON-LD, même source)
     rédigée uniquement avec les faits de la page, 5 au plus.
  5. Requêtes vues sans page adaptée (position moyenne > 20) : transmises à la file de sujets du site.
  6. Contrôles du dépôt (lint, types, tests, build, validateurs). Un échec : tout est jeté, passage en échec (le
     workflow envoie l'alerte). Sinon commit sur main et déploiement normal (workflow de déploiement relancé).
  7. Résumé du passage (GITHUB_STEP_SUMMARY) et journal tenu dans le dépôt.

  python3 scripts/seo/seo_mensuel.py --dry-run            # tout sauf commit, push et déploiement
  python3 scripts/seo/seo_mensuel.py --dry-run --no-checks
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import adaptateur as A  # noqa: E402

ROOT = A.ROOT
ZH = ZoneInfo("Europe/Zurich")
JOURNAL = ROOT / "data" / "seo-journal.json"
CI = bool(os.environ.get("GITHUB_ACTIONS"))
RUN_URL = (f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}"
           f"/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}") if CI else ""
ATTRIBUTION = ("Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
               "Claude-Session: https://claude.ai/code/session_01L55SB7MhNTkTbmXLcp3t83")

MIN_IMPR_META = getattr(A, "MIN_IMPR_META", 100)
MAX_META = getattr(A, "MAX_META", 5)
MIN_IMPR_FAQ = getattr(A, "MIN_IMPR_FAQ", 20)
MAX_FAQ = getattr(A, "MAX_FAQ", 5)
MIN_IMPR_SUJET = getattr(A, "MIN_IMPR_SUJET", 10)
MAX_SUJETS = getattr(A, "MAX_SUJETS", 10)
PAUSE_META_JOURS = 90   # une page dont le titre a changé n'est pas retouchée avant 90 jours (le temps de mesurer)
PAUSE_FAQ_JOURS = 30

LANGUES = {"fr": "français", "en": "anglais", "de": "allemand", "it": "italien", "es": "espagnol", "pt": "portugais"}
VIDES = set("""le la les l un une des du de d et ou en au aux a à pour par sur dans avec sans ce ces cette son sa ses
leur leurs qui que quoi quel quelle quels quelles est sont comment pourquoi combien the a an of to for in on and or
is are how what why which with without vs der die das und oder ein eine für mit von zu im in ist wie was el los las
un una para con por del y o que como en""".split())


# ------------------------------------------------------------------ journal du passage
LOG: list[str] = []


def log(msg: str) -> None:
    line = f"{dt.datetime.now(ZH).strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    LOG.append(line)


def resume(md: str) -> None:
    f = os.environ.get("GITHUB_STEP_SUMMARY")
    if f:
        with open(f, "a", encoding="utf-8") as fh:
            fh.write(md + "\n")
    else:
        print(md)


def pct(x: float) -> str:
    return f"{x * 100:.1f} %".replace(".", ",")


def num(x: float, d: int = 1) -> str:
    return f"{x:.{d}f}".replace(".", ",")


def fr_jour(d: dt.date) -> str:
    return d.strftime("%d.%m.%Y")


# ------------------------------------------------------------------ Search Console
def gsc_jeton() -> str:
    from google.oauth2 import service_account
    import google.auth.transport.requests
    brut = os.environ.get("GSC_SA_JSON") or (Path(os.environ["GSC_SA_FILE"]).read_text()
                                             if os.environ.get("GSC_SA_FILE") else "")
    if not brut:
        raise RuntimeError("GSC_SA_JSON absent (secret GitHub Actions)")
    cr = service_account.Credentials.from_service_account_info(
        json.loads(brut), scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
    cr.refresh(google.auth.transport.requests.Request())
    return cr.token


def gsc(jeton: str, debut: dt.date, fin: dt.date, dims: list[str]) -> list[dict]:
    url = ("https://www.googleapis.com/webmasters/v3/sites/" + urllib.parse.quote(A.PROPRIETE, safe="")
           + "/searchAnalytics/query")
    rows, start = [], 0
    while True:
        body = {"startDate": debut.isoformat(), "endDate": fin.isoformat(), "dimensions": dims,
                "rowLimit": 25000, "startRow": start, "type": "web"}
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {jeton}", "Content-Type": "application/json"})
        for essai in range(3):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    lot = json.load(r).get("rows", [])
                break
            except urllib.error.HTTPError as e:
                if e.code < 500 or essai == 2:
                    raise RuntimeError(f"Search Console {e.code} : {e.read()[:300]!r}") from None
                time.sleep(5 * (essai + 1))
        rows += lot
        if len(lot) < 25000:
            return rows
        start += 25000


def chemin(url: str) -> str | None:
    u = urllib.parse.urlparse(url)
    if u.hostname and u.hostname.removeprefix("www.") != A.HOTE:
        return None
    p = urllib.parse.unquote(u.path) or "/"
    return p if p.endswith("/") or "." in p.rsplit("/", 1)[-1] else p + "/"


def agreger(rows: list[dict], cle) -> dict:
    out: dict = {}
    for r in rows:
        k = cle(r["keys"])
        if k is None:
            continue
        m = out.setdefault(k, {"clics": 0, "impressions": 0, "_pos": 0.0})
        m["clics"] += r["clicks"]
        m["impressions"] += r["impressions"]
        m["_pos"] += r["position"] * r["impressions"]
    for m in out.values():
        m["position"] = round(m.pop("_pos") / m["impressions"], 1) if m["impressions"] else 0.0
        m["ctr"] = round(m["clics"] / m["impressions"], 4) if m["impressions"] else 0.0
    return out


def donnees_gsc() -> dict:
    fin = dt.date.today() - dt.timedelta(days=3)       # Search Console a 2 à 3 jours de retard
    debut = fin - dt.timedelta(days=27)
    fin_p, debut_p = debut - dt.timedelta(days=1), debut - dt.timedelta(days=28)
    j = gsc_jeton()
    d = {"periode": (debut, fin), "periode_prec": (debut_p, fin_p)}
    for nom, (a, b) in (("act", (debut, fin)), ("prec", (debut_p, fin_p))):
        d[nom] = {
            "pages": agreger(gsc(j, a, b, ["page"]), lambda k: chemin(k[0])),
            "requetes": agreger(gsc(j, a, b, ["query"]), lambda k: k[0].strip().lower()),
            "rp": agreger(gsc(j, a, b, ["query", "page"]),
                          lambda k: (k[0].strip().lower(), chemin(k[1])) if chemin(k[1]) else None),
        }
    log(f"Search Console {A.PROPRIETE} : {len(d['act']['pages'])} pages, {len(d['act']['requetes'])} requêtes "
        f"du {fr_jour(debut)} au {fr_jour(fin)} ; période précédente {len(d['prec']['pages'])} pages")
    return d


def ctr_attendu(pos: float) -> float:
    """CTR organique moyen par position (ordre de grandeur des études publiées, volontairement prudent)."""
    for p, c in ((1.5, .25), (2.5, .14), (3.5, .09), (4.5, .065), (5.5, .05), (6.5, .04), (7.5, .032),
                 (8.5, .027), (10.5, .022), (15, .012), (20, .008), (30, .005)):
        if pos <= p:
            return c
    return .003


# ------------------------------------------------------------------ texte
def plat(s: str) -> str:
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()


def jetons(s: str) -> set[str]:
    return {w[:6] for w in re.findall(r"[a-z0-9]+", plat(s)) if len(w) > 2 and w not in VIDES}


def recouvrement(a: str, b: str) -> float:
    x, y = jetons(a), jetons(b)
    return len(x & y) / len(x | y) if x and y else 0.0


def nombres(t: str) -> set[str]:
    t = re.sub(r"https?://\S+", " ", t)
    out = set()
    for m in re.finditer(r"\d+(?:[  '’.,]\d{3})*(?:[.,]\d+)?", t):
        out.add(re.sub(r"[  '’]", "", m.group(0)).replace(",", "."))
    return out


def typo_fr(s: str) -> str:
    s = re.sub(r"[   ]*([;!?])", " \\1", s)
    s = re.sub(r"(?<!\d)[   ]*:(?!\d)", " :", s)
    s = re.sub(r"«[   ]*", "« ", s)
    s = re.sub(r"[   ]*»", " »", s)
    if getattr(A, "APOSTROPHE_COURBE", True):
        s = re.sub(r"(?<=\w)'(?=\w)", "’", s)
    return re.sub(r"^ ", "", s).strip()


def typo_autres(s: str) -> str:
    s = re.sub(r"[  ]+([;:!?])", r"\1", s)
    return s.replace(" ", " ").replace(" ", " ").strip()


def nettoyer(s: str, locale: str) -> str:
    s = re.sub(r"\s+", " ", str(s or "")).strip().strip('"')
    return typo_fr(s) if locale == "fr" else typo_autres(s)


STYLE = re.compile(r"[—–]|!|\bdécouvrez\b|\bplongez\b|\bincontournable|\bultime\b|\brévolutionn|"
                   r"\bdiscover\b|\bunlock\b|\bultimate\b|\bdelve\b|\bseamless|\bgame.?changer", re.I)
INTERDITS = [(re.compile(r, re.I), m) for r, m in getattr(A, "INTERDITS", [])]
if os.environ.get("FORBIDDEN_PATTERNS"):
    INTERDITS.append((re.compile(os.environ["FORBIDDEN_PATTERNS"], re.I), "mention interdite (secret)"))


def defauts_communs(texte: str, page_texte: str) -> list[str]:
    e = []
    m = STYLE.search(texte)
    if m:
        e.append(f"style interdit : « {m.group(0)} » (pas de tiret long ou demi-cadratin, pas de point "
                 "d'exclamation, pas de formule publicitaire)")
    for rx, motif in INTERDITS:
        m = rx.search(texte)
        if m:
            e.append(f"mot interdit ({motif}) : « {m.group(0)} »")
    inv = sorted(nombres(texte) - nombres(page_texte))
    if inv:
        e.append("chiffres absents du texte de la page (interdit d'en inventer) : " + ", ".join(inv))
    return e


# ------------------------------------------------------------------ LLM
def llm(systeme: str, utilisateur: str) -> dict:
    ep, key = os.environ.get("AZURE_OPENAI_ENDPOINT", ""), os.environ.get("AZURE_OPENAI_API_KEY", "")
    if not ep or not key:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT ou AZURE_OPENAI_API_KEY absent (secrets GitHub Actions)")
    dep = os.environ.get("AZURE_OPENAI_DEPLOYMENT") or A.DEPLOIEMENT_LLM
    ver = os.environ.get("AZURE_OPENAI_API_VERSION") or getattr(A, "VERSION_API_LLM", "2024-05-01-preview")
    u = urllib.parse.urlparse(ep.strip() if "://" in ep else "https://" + ep.strip())
    p = u.path
    if "/openai/deployments/" in p:  # secret qui contient l'URL complète : on garde son déploiement
        p = p.rstrip("/")
        p = p if p.endswith("/chat/completions") else p + "/chat/completions"
    else:
        p = f"/openai/deployments/{urllib.parse.quote(dep)}/chat/completions"
    q = urllib.parse.parse_qs(u.query)
    q.setdefault("api-version", [ver])
    url = urllib.parse.urlunparse((u.scheme, u.netloc, p, "", urllib.parse.urlencode(q, doseq=True), ""))
    body = {"messages": [{"role": "system", "content": systeme}, {"role": "user", "content": utilisateur}],
            "temperature": 0.4, "max_tokens": 1200, "response_format": {"type": "json_object"}}
    for essai in range(3):
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                     headers={"api-key": key, "content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                rep = json.load(r)
            t = rep["choices"][0]["message"]["content"]
            return json.loads(re.search(r"\{.*\}", t, re.S).group(0))
        except urllib.error.HTTPError as e:
            if e.code == 400 and "response_format" in body:
                body.pop("response_format")
                continue
            if e.code < 500 and e.code != 429 or essai == 2:
                raise RuntimeError(f"LLM HTTP {e.code} : {e.read()[:300]!r}") from None
        except (json.JSONDecodeError, AttributeError):
            if essai == 2:
                raise RuntimeError("réponse du LLM sans objet JSON lisible") from None
        time.sleep(8 * (essai + 1))
    raise RuntimeError("LLM injoignable")


HUMAIN = """Écris comme un rédacteur humain attentif, pas comme une machine : phrases naturelles et complètes, vocabulaire
concret, pas de style télégraphique « Étiquette : valeur », pas de tiret long ni demi-cadratin (— –), pas de tournure
« pas X mais Y », pas de triplets décoratifs, pas de point d'exclamation, pas d'emoji, pas de majuscule à chaque mot,
pas de mots creux (découvrez, plongez, incontournable, ultime, essentiel, tout savoir, guide complet)."""

SYS_META = """Tu réécris le titre (balise title) et la meta description d'une page du site {site} pour améliorer son taux de
clic dans Google. La page est déjà bien placée mais trop peu cliquée.
Règles impératives (contrôlées automatiquement, une réponse fautive est jetée) :
- Langue : {langue}, celle de la page.
- title : 60 caractères au plus, espaces compris (vise 45 à 58). description : de 130 à 155 caractères.
- Garde la requête principale « {kw} » (ses mots importants) dans le titre, au plus près du début.
- Le titre et la description répondent à l'intention des requêtes listées et donnent une raison concrète de cliquer,
  tirée du texte de la page.
- N'utilise QUE des faits présents dans le TEXTE DE LA PAGE. Aucun chiffre, prix, montant, délai, taux ou promesse
  qui n'y figure pas tel quel.
- {humain}
- Règles du site : {regles}
Les longueurs sont contrôlées au caractère près : propose 4 titres de plus en plus courts (du plus long, proche de
la limite, au plus court, environ 15 caractères de moins) et 3 descriptions de longueurs différentes dans la fourchette.
Réponds uniquement par un objet JSON : {{"titles": ["...", "...", "...", "..."], "descriptions": ["...", "...", "..."]}}"""

SYS_FAQ = """Tu ajoutes UNE question de FAQ à une page du site {site}, pour répondre à une recherche Google pour laquelle la
page est en position 5 à 20.
Règles impératives (contrôlées automatiquement, une réponse fautive est jetée) :
- Langue : {langue}, celle de la page.
- La question reprend l'intention de la requête « {req} », formulée comme une vraie question d'internaute, terminée
  par un point d'interrogation, 120 caractères au plus.
- La réponse fait de 35 à 90 mots, commence par répondre directement, et n'utilise QUE des faits présents dans le TEXTE
  DE LA PAGE (aucun chiffre, prix, délai, nom ou promesse qui n'y figure pas). Pas de lien, pas de markdown.
- Si une question existante de la FAQ répond déjà à cette intention, mets "deja_couverte": true. Si le texte de la
  page ne contient pas les faits pour répondre, mets "faits_suffisants": false.
- {humain}
- Règles du site : {regles}
Réponds uniquement par un objet JSON : {{"deja_couverte": false, "faits_suffisants": true, "q": "...", "a": "..."}}"""

SYS_SUJETS = """Tu tries des recherches Google pour le site {site} ({theme}). Ces requêtes ont des impressions mais aucune
page du site n'y répond bien. Garde seulement celles qui pourraient faire l'objet d'un article utile et conforme au site.
Écarte : les requêtes qui nomment une entreprise, une marque, un produit commercial ou une personne ; celles hors du
thème du site ; les requêtes de navigation (connexion, adresse, numéro de téléphone) ; les doublons d'intention
(garde la formulation la plus fréquente). Règles du site : {regles}
Réponds uniquement par un objet JSON : {{"garder": [{{"requete": "...", "angle": "une phrase en français : l'article à écrire"}}]}}"""


# ------------------------------------------------------------------ propositions
def max_titre(page) -> int:
    return 60 - len(page.suffixe)


def meta_valide(prop: dict, page, kw: str, texte: str) -> tuple[str, str, list[str]]:
    """Garde le premier titre et la première description qui passent tous les contrôles."""
    titres = prop.get("titles") or [prop.get("title", "")]
    descs = prop.get("descriptions") or [prop.get("description", "")]
    ref = texte + " " + page.title + " " + page.description
    kj = jetons(kw)
    et, t_ok = [], None
    for t in titres:
        t = nettoyer(t, page.locale)
        if page.suffixe and t.endswith(page.suffixe.strip()):
            t = t[: -len(page.suffixe.strip())].rstrip(" |-")
        e = []
        if not t or len(t) > max_titre(page):
            e.append(f"title « {t} » de {len(t)} caractères ({max_titre(page)} au plus)")
        if kj and len(kj & jetons(t)) < math.ceil(len(kj) / 2):
            e.append(f"la requête principale « {kw} » n'est pas dans le titre « {t} »")
        e += defauts_communs(t, ref)
        if not e:
            t_ok = t
            break
        et += e
    ed, d_ok = [], None
    for d in descs:
        d = nettoyer(d, page.locale)
        e = [] if 130 <= len(d) <= 155 else [f"description de {len(d)} caractères (130 à 155)"]
        e += defauts_communs(d, ref)
        if not e:
            d_ok = d
            break
        ed += e
    e = ([] if t_ok else et) + ([] if d_ok else ed)
    if not e and t_ok + page.suffixe == page.title and d_ok == page.description:
        e.append("aucun changement")
    return t_ok or "", d_ok or "", e


def proposer_meta(page, kw: str, requetes: list[tuple[str, dict]]) -> tuple[str, str] | None:
    texte = page.texte()[:14000]
    sysm = SYS_META.format(site=A.NOM, langue=LANGUES.get(page.locale, page.locale), kw=kw, humain=HUMAIN,
                           regles=A.REGLES_SITE).replace("60 caractères au plus, espaces compris (vise 45 à 58)",
                                                         f"{max_titre(page)} caractères au plus, espaces compris (vise "
                                                         f"{max_titre(page) - 14} à {max_titre(page) - 2})")
    if page.suffixe:
        sysm += (f"\nLe site ajoute lui-même « {page.suffixe.strip()} » à la fin du titre : ne l'écris pas, et ne nomme "
                 "pas la marque dans le titre.")
    usr = (f"URL : {A.BASE_URL}{page.url}\nTitre actuel : {page.title}\nDescription actuelle : {page.description}\n\n"
           "Requêtes Google de la page (28 jours) :\n"
           + "\n".join(f"- « {q} » : {m['impressions']} impressions, position {num(m['position'])}, CTR {pct(m['ctr'])}"
                       for q, m in requetes[:8])
           + f"\n\nTEXTE DE LA PAGE :\n{texte}")
    prop = llm(sysm, usr)
    t, d, e = meta_valide(prop, page, kw, texte)
    if e:
        log(f"  essai 1 rejeté : {' | '.join(e)}")
        prop = llm(sysm, usr + "\n\nTA RÉPONSE PRÉCÉDENTE : " + json.dumps(prop, ensure_ascii=False)
                   + "\nELLE A ÉCHOUÉ AUX CONTRÔLES :\n- " + "\n- ".join(e) + "\nCorrige tous ces points.")
        t, d, e = meta_valide(prop, page, kw, texte)
        if e:
            log(f"  essai 2 rejeté : {' | '.join(e)} ; page laissée telle quelle")
            return None
    return t, d


def faq_valide(prop: dict, page, texte: str) -> tuple[str, str, list[str]]:
    q = nettoyer(prop.get("q", ""), page.locale)
    a = nettoyer(prop.get("a", ""), page.locale)
    e = []
    if not q.endswith("?") or len(q) > 120:
        e.append("question absente, trop longue ou sans point d'interrogation")
    n = len(re.findall(r"[\w’'-]+", a))
    if not 35 <= n <= 95:
        e.append(f"réponse de {n} mots (35 à 90)")
    if re.search(r"https?://|\]\(|\*\*|<[a-z]", a):
        e.append("lien, markdown ou HTML dans la réponse")
    for f in page.faq or []:
        if recouvrement(q, f["q"]) >= 0.5:
            e.append(f"question trop proche d'une question existante (« {f['q']} »)")
            break
    e += defauts_communs(q + " \n " + a, texte)
    return q, a, e


def proposer_faq(page, req: str) -> tuple[str, str] | None:
    texte = page.texte()[:16000]
    sysm = SYS_FAQ.format(site=A.NOM, langue=LANGUES.get(page.locale, page.locale), req=req, humain=HUMAIN,
                          regles=A.REGLES_SITE)
    usr = (f"URL : {A.BASE_URL}{page.url}\nRequête : « {req} »\n\nFAQ existante :\n"
           + ("\n".join(f"- {f['q']}" for f in page.faq) or "(vide)") + f"\n\nTEXTE DE LA PAGE :\n{texte}")
    prop = llm(sysm, usr)
    for essai in (1, 2):
        if prop.get("deja_couverte") or prop.get("faits_suffisants") is False:
            log("  " + ("déjà couverte par la FAQ" if prop.get("deja_couverte") else "pas assez de faits dans la page")
                + " : rien ajouté")
            return None
        q, a, e = faq_valide(prop, page, texte)
        if not e:
            return q, a
        log(f"  essai {essai} rejeté : {' | '.join(e)}")
        if essai == 1:
            prop = llm(sysm, usr + "\n\nTA RÉPONSE PRÉCÉDENTE : " + json.dumps(prop, ensure_ascii=False)
                       + "\nELLE A ÉCHOUÉ AUX CONTRÔLES :\n- " + "\n- ".join(e) + "\nCorrige tous ces points.")
    log("  question laissée de côté")
    return None


SYS_TRAD = """Tu adaptes une question de FAQ du site {site} et sa réponse dans d'autres langues, pour les versions
de la même page dans ces langues. Garde exactement le même sens, les mêmes faits et les mêmes chiffres, sans rien
ajouter, aucune promesse ni garantie (jamais « garantir », « guarantee », « garantizar »...). Formulation naturelle dans chaque langue, comme un rédacteur natif. La question finit par un point
d'interrogation. Pas de tiret long ni demi-cadratin, pas de markdown, pas de lien. Français : espace fine insécable
avant ; : ! ? et dans les guillemets « ». Autres langues : ponctuation collée au mot.
Règles du site : {regles}
Réponds uniquement par un objet JSON : {{{schema}}}"""


def traduire_faq(page, q: str, a: str) -> dict | None:
    soeurs = getattr(page, "soeurs", {}) or {}
    if not soeurs:
        return {}
    locs = sorted(soeurs)
    schema = ", ".join(f'"{l}": {{"q": "...", "a": "..."}}' for l in locs)
    rep = llm(SYS_TRAD.format(site=A.NOM, regles=A.REGLES_SITE, schema=schema),
              f"Langue d'origine : {LANGUES.get(page.locale, page.locale)}.\nLangues cibles : "
              + ", ".join(f"{l} ({LANGUES.get(l, l)})" for l in locs) + f"\n\nQuestion : {q}\nRéponse : {a}")
    out = {}
    for l in locs:
        x = rep.get(l) or {}
        tq, ta = nettoyer(x.get("q", ""), l), nettoyer(x.get("a", ""), l)
        e = []
        if not tq.endswith("?") or not ta:
            e.append("question ou réponse vide")
        e += defauts_communs(tq + " \n " + ta, q + " " + a)
        if e:
            log(f"  version {l} rejetée : {' | '.join(e)} ; question laissée de côté (toutes les langues ou aucune)")
            return None
        out[l] = (tq, ta)
    return out


# ------------------------------------------------------------------ journal (data/seo-journal.json)
def lire_journal() -> dict:
    if JOURNAL.exists():
        return json.loads(JOURNAL.read_text(encoding="utf-8"))
    return {"_lisezmoi": "Tenu par scripts/seo/seo_mensuel.py (workflow seo-mensuel.yml) : chaque changement avec sa date "
                         "et les mesures Search Console d'avant, pour en mesurer l'effet le mois suivant.",
            "passages": []}


def changements_recents(j: dict, type_: str, jours: int) -> set[str]:
    lim = (dt.date.today() - dt.timedelta(days=jours)).isoformat()
    return {c["url"] for p in j["passages"] if p["date"] >= lim for c in p.get("changements", []) if c["type"] == type_}


def requetes_traitees(j: dict) -> set[str]:
    out = set()
    for p in j["passages"]:
        out |= {c.get("requete", "") for c in p.get("changements", []) if c["type"] == "faq"}
        out |= {s["requete"] for s in p.get("sujets", [])}
        out |= set(p.get("sujets_ecartes", []))
    return out


def effet(j: dict, g: dict) -> list[str]:
    """Pages changées il y a au moins 21 jours (et moins d'un an) : mesures d'avant contre les 28 derniers jours."""
    lignes = []
    lim_haut = (dt.date.today() - dt.timedelta(days=21)).isoformat()
    lim_bas = (dt.date.today() - dt.timedelta(days=365)).isoformat()
    for p in j["passages"]:
        if not lim_bas <= p["date"] <= lim_haut:
            continue
        for c in p.get("changements", []):
            av = c.get("mesures_avant") or {}
            ap = g["act"]["pages"].get(c["url"], {"clics": 0, "impressions": 0, "ctr": 0.0, "position": 0.0})
            if not av:
                continue
            lignes.append(f"| {c['url']} | {c['type']} | {fr_jour(dt.date.fromisoformat(p['date']))} | "
                          f"{av['clics']} → {ap['clics']} ({ap['clics'] - av['clics']:+d}) | "
                          f"{pct(av['ctr'])} → {pct(ap['ctr'])} | {num(av['position'])} → {num(ap['position'])} |")
    return lignes


# ------------------------------------------------------------------ contrôles, commit, déploiement
def sh(cmd: str, cwd: Path, timeout: int = 2400) -> tuple[int, str]:
    log(f"$ {cmd}" + (f"  (dans {cwd.relative_to(ROOT)})" if cwd != ROOT else ""))
    r = subprocess.run(["bash", "-o", "pipefail", "-c", cmd], cwd=cwd, capture_output=True, text=True, timeout=timeout)
    out = (r.stdout + r.stderr).strip()
    for ln in out.splitlines()[-15:]:
        log("  | " + ln[:300])
    return r.returncode, out


def liste_controles(fichiers: list[Path]) -> list[tuple[str, str, str]]:
    return A.controles(fichiers) if hasattr(A, "controles") else A.CONTROLES


def controles(fichiers: list[Path]) -> list[str]:
    echecs = []
    for nom, cmd, cwd in liste_controles(fichiers):
        code, out = sh(cmd, ROOT / cwd)
        if code:
            echecs.append(f"{nom} (code {code}) : " + " / ".join(out.splitlines()[-6:])[:600])
            break  # inutile de construire si le lint échoue
    return echecs


def annuler(fichiers: list[Path], nouveaux: list[Path]) -> None:
    rel = [str(p.relative_to(ROOT)) for p in fichiers if p not in nouveaux]
    if rel:
        subprocess.run(["git", "checkout", "--", *rel], cwd=ROOT, check=False)
    for p in nouveaux:
        p.unlink(missing_ok=True)


def commit_push(fichiers: list[Path], message: str) -> str:
    rel = sorted({str(p.relative_to(ROOT)) for p in fichiers})
    subprocess.run(["git", "add", "--", *rel], cwd=ROOT, check=True)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
        return ""
    subprocess.run(["git", "-c", f"user.name={A.BOT}", "-c",
                    "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-q", "-F", "-"],
                   cwd=ROOT, input=message, text=True, check=True)
    for _ in range(3):
        if subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=ROOT).returncode == 0:
            return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True,
                                  text=True).stdout.strip()
        subprocess.run(["git", "pull", "-q", "--rebase", "origin", "main"], cwd=ROOT, check=False)
    raise RuntimeError("push sur main refusé trois fois")


# ------------------------------------------------------------------ passage
def run(a) -> int:
    today = dt.date.today()
    A.LLM = llm
    g = donnees_gsc()
    (d0, d1), (p0, p1) = g["periode"], g["periode_prec"]
    j = lire_journal()
    pages = A.pages()
    log(f"{len(pages)} pages modifiables automatiquement")
    rp = g["act"]["rp"]
    par_page: dict[str, list[tuple[str, dict]]] = {}
    for (q, u), m in rp.items():
        par_page.setdefault(u, []).append((q, m))
    for v in par_page.values():
        v.sort(key=lambda x: -x[1]["impressions"])

    tot_a = {k: sum(m[k] for m in g["act"]["pages"].values()) for k in ("clics", "impressions")}
    tot_p = {k: sum(m[k] for m in g["prec"]["pages"].values()) for k in ("clics", "impressions")}
    resume(f"## SEO mensuel {A.NOM} : {'simulation (dry-run)' if a.dry_run else 'passage réel'}\n\n"
           f"Search Console, {fr_jour(d0)} au {fr_jour(d1)} : **{tot_a['clics']} clics, {tot_a['impressions']} "
           f"impressions** (28 jours précédents : {tot_p['clics']} clics, {tot_p['impressions']} impressions).\n")

    lignes = effet(j, g)
    resume("### Effet des changements précédents\n\n" + (
        "| Page | Type | Date | Clics (28 j avant → 28 derniers j) | CTR | Position |\n|---|---|---|---|---|---|\n"
        + "\n".join(lignes) if lignes else "Aucun changement de plus de 21 jours à mesurer.") + "\n")

    changements, fichiers, nouveaux = [], [], []

    # --- titres et descriptions
    pause = changements_recents(j, "meta", PAUSE_META_JOURS)
    cands = []
    for u, m in g["act"]["pages"].items():
        if m["impressions"] < MIN_IMPR_META or m["position"] > 30 or u not in pages or u in pause:
            continue
        if not pages[u].meta_ok:
            continue
        att = ctr_attendu(m["position"])
        if m["ctr"] < 0.6 * att:
            cands.append((m["impressions"] * (att - m["ctr"]), u, m, att))
    cands.sort(reverse=True)
    log(f"titres : {len(cands)} page(s) à CTR faible pour leur position")
    for _, u, m, att in cands[:MAX_META]:
        page = pages[u]
        reqs = par_page.get(u, [])
        kw = next((q for q, _ in reqs if not re.search(A.MARQUE, q, re.I)), "")  # la marque est déjà dans le suffixe
        log(f"titre {u} : {m['impressions']} impr., CTR {pct(m['ctr'])} (attendu ~{pct(att)}), position "
            f"{num(m['position'])}, requête principale « {kw} »")
        try:
            r = proposer_meta(page, kw, reqs)
        except RuntimeError as e:
            log(f"  LLM : {e}")
            raise
        if not r:
            continue
        t, d = r
        t += page.suffixe
        fichiers += A.ecrire_meta(page, t, d)
        changements.append({"type": "meta", "url": u, "fichier": page.fichier, "locale": page.locale, "requete": kw,
                            "avant": {"title": page.title, "description": page.description},
                            "apres": {"title": t, "description": d},
                            "mesures_avant": {k: m[k] for k in ("clics", "impressions", "ctr", "position")},
                            "ctr_attendu": att})

    # --- FAQ
    traitees = requetes_traitees(j)
    pause_faq = changements_recents(j, "faq", PAUSE_FAQ_JOURS)
    cands = []
    for (q, u), m in rp.items():
        if not (5 <= m["position"] <= 20) or m["impressions"] < MIN_IMPR_FAQ or u not in pages or u in pause_faq:
            continue
        pg = pages[u]
        if pg.faq is None or q in traitees or re.search(A.MARQUE, q, re.I) or len(jetons(q)) < 1:
            continue
        if len(pg.faq) >= pg.faq_max or any(s.faq is None or len(s.faq) >= s.faq_max for s in pg.soeurs.values()):
            continue
        if any(recouvrement(q, f["q"]) >= 0.5 for f in pages[u].faq):
            continue
        cands.append((m["impressions"], q, u, m))
    cands.sort(reverse=True)
    log(f"FAQ : {len(cands)} requête(s) en position 5 à 20")
    vues = set()
    for _, q, u, m in cands:
        if sum(c["type"] == "faq" for c in changements) >= MAX_FAQ:
            break
        if u in vues:
            continue
        page = pages[u]
        log(f"FAQ {u} : « {q} », {m['impressions']} impr., position {num(m['position'])}")
        r = proposer_faq(page, q)
        if not r:
            continue
        fq, fa = r
        trads = traduire_faq(page, fq, fa)
        if trads is None:
            continue
        vues.add(u)
        fichiers += A.ajouter_faq(page, fq, fa)
        page.faq.append({"q": fq, "a": fa})
        for l, (tq, ta) in trads.items():
            s = page.soeurs[l]
            fichiers += A.ajouter_faq(s, tq, ta)
            s.faq.append({"q": tq, "a": ta})
            log(f"  version {l} : {tq}")
        pm = g["act"]["pages"].get(u, m)
        changements.append({"type": "faq", "url": u, "fichier": page.fichier, "locale": page.locale, "requete": q,
                            "apres": {"q": fq, "a": fa},
                            "autres_langues": {l: page.soeurs[l].url for l in trads},
                            "mesures_requete": {k: m[k] for k in ("clics", "impressions", "ctr", "position")},
                            "mesures_avant": {k: pm[k] for k in ("clics", "impressions", "ctr", "position")}})

    # --- sujets sans page adaptée
    meilleure: dict[str, float] = {}
    for (q, u), m in rp.items():
        meilleure[q] = min(meilleure.get(q, 999.0), m["position"])
    bruts = [(m["impressions"], q, m) for q, m in g["act"]["requetes"].items()
             if m["impressions"] >= MIN_IMPR_SUJET and m["position"] > 20 and meilleure.get(q, 999) > 20
             and q not in traitees and not re.search(A.MARQUE, q, re.I) and len(q) >= 6]
    bruts.sort(reverse=True)
    bruts = bruts[:40]
    sujets, ecartes = [], []
    if bruts:
        rep = llm(SYS_SUJETS.format(site=A.NOM, theme=A.THEME, regles=A.REGLES_SITE),
                  "Requêtes (impressions, position moyenne) :\n"
                  + "\n".join(f"- {q} ({m['impressions']}, {num(m['position'])})" for _, q, m in bruts))
        garder = {plat(x.get("requete", "")).strip(): x.get("angle", "") for x in rep.get("garder", [])}
        for _, q, m in bruts:
            if plat(q) in garder and len(sujets) < MAX_SUJETS:
                sujets.append({"requete": q, "angle": nettoyer(garder[plat(q)], "fr"), "impressions": m["impressions"],
                               "position": m["position"], "ajoute": today.isoformat()})
            else:
                ecartes.append(q)
    log(f"sujets : {len(bruts)} requête(s) sans page adaptée, {len(sujets)} retenue(s)")
    if sujets:
        f, n = A.ajouter_sujets(sujets)
        fichiers += f
        nouveaux += n

    # --- résumé des propositions
    md = ["### Changements " + ("proposés (non publiés)" if a.dry_run else "")]
    metas = [c for c in changements if c["type"] == "meta"]
    faqs = [c for c in changements if c["type"] == "faq"]
    if metas:
        md.append("\n**Titres et descriptions** (CTR faible pour la position)\n")
        for c in metas:
            mv = c["mesures_avant"]
            md.append(f"- `{c['url']}` ({mv['impressions']} impressions, CTR {pct(mv['ctr'])}, position "
                      f"{num(mv['position'])}, requête « {c['requete']} »)\n"
                      f"  - avant : {c['avant']['title']} / {c['avant']['description']}\n"
                      f"  - après : **{c['apres']['title']}** / {c['apres']['description']}")
    if faqs:
        md.append("\n**Questions de FAQ ajoutées** (requêtes en position 5 à 20)\n")
        for c in faqs:
            mr = c["mesures_requete"]
            md.append(f"- `{c['url']}`, requête « {c['requete']} » ({mr['impressions']} impressions, position "
                      f"{num(mr['position'])})\n  - **{c['apres']['q']}** {c['apres']['a']}")
    if sujets:
        md.append(f"\n**Sujets transmis** ({A.DEST_SUJETS})\n")
        md += [f"- « {s['requete']} » ({s['impressions']} impressions, position {num(s['position'])}) : {s['angle']}"
               for s in sujets]
    if not (changements or sujets):
        md.append("\nRien à changer ce mois-ci : aucune page ne remplit les critères (impressions, CTR, position).")
    resume("\n".join(md) + "\n")

    if not (changements or sujets):
        return 0

    # --- journal
    passage = {"date": today.isoformat(), "passage": RUN_URL, "periode": [d0.isoformat(), d1.isoformat()],
               "changements": changements, "sujets": sujets, "sujets_ecartes": ecartes[:40]}
    j["passages"].append(passage)
    existait = JOURNAL.exists()
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    JOURNAL.write_text(json.dumps(j, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    fichiers.append(JOURNAL)
    if not existait:
        nouveaux.append(JOURNAL)
    fichiers = sorted(set(fichiers))

    diff = subprocess.run(["git", "diff", "--stat", "--", *[str(p.relative_to(ROOT)) for p in fichiers]], cwd=ROOT,
                          capture_output=True, text=True).stdout
    log("fichiers modifiés :\n" + diff)

    # --- contrôles
    if a.no_checks:
        resume("Contrôles du dépôt : non lancés (--no-checks).\n")
        echecs = []
    else:
        echecs = controles(fichiers)
        resume("### Contrôles du dépôt\n\n" + (
            "Tous passés : " + ", ".join(n for n, _, _ in liste_controles(fichiers)) + "." if not echecs
            else "**Échec** : " + echecs[0] + "\n\nTous les changements sont jetés.") + "\n")
    if echecs or a.dry_run:
        if a.dry_run and not echecs:
            full = subprocess.run(["git", "diff", "--", *[str(p.relative_to(ROOT)) for p in fichiers if p != JOURNAL]],
                                  cwd=ROOT, capture_output=True, text=True).stdout
            resume("<details><summary>Diff proposé</summary>\n\n```diff\n" + full[:60000] + "\n```\n</details>\n")
        annuler(fichiers, nouveaux)
        if echecs:
            Path(ROOT / ".seo-echec.txt").write_text("\n".join(echecs), encoding="utf-8")
            return 1
        return 0

    # --- commit et déploiement
    tete = []
    if metas:
        tete.append(f"{len(metas)} titre{'s' if len(metas) > 1 else ''} et description{'s' if len(metas) > 1 else ''}")
    if faqs:
        tete.append(f"{len(faqs)} question{'s' if len(faqs) > 1 else ''} de FAQ")
    if sujets:
        tete.append(f"{len(sujets)} sujet{'s' if len(sujets) > 1 else ''}")
    corps = [f"{getattr(A, 'PREFIXE_COMMIT', '')}SEO mensuel : {', '.join(tete)} (Search Console du {fr_jour(d0)} au "
             f"{fr_jour(d1)})", ""]
    if metas:
        corps.append("Titres et descriptions réécrits, CTR faible pour la position :")
        for c in metas:
            mv = c["mesures_avant"]
            corps.append(f"- {c['url']} : {mv['impressions']} impressions, {mv['clics']} clics, CTR {pct(mv['ctr'])} "
                         f"pour ~{pct(c['ctr_attendu'])} attendu en position {num(mv['position'])} ; requête "
                         f"« {c['requete']} » ; nouveau titre « {c['apres']['title']} »")
        corps.append("")
    if faqs:
        corps.append("Questions de FAQ ajoutées, requêtes en position 5 à 20 :")
        for c in faqs:
            mr = c["mesures_requete"]
            corps.append(f"- {c['url']} : « {c['apres']['q']} » (requête « {c['requete']} », {mr['impressions']} "
                         f"impressions, position {num(mr['position'])})")
        corps.append("")
    if sujets:
        corps.append(f"Sujets transmis ({A.DEST_SUJETS}), requêtes sans page adaptée :")
        corps += [f"- « {s['requete']} » : {s['impressions']} impressions, position {num(s['position'])}" for s in sujets]
        corps.append("")
    corps.append("Contrôles passés : " + ", ".join(n for n, _, _ in liste_controles(fichiers)) + ".")
    if RUN_URL:
        corps.append(f"Passage : {RUN_URL}")
    corps += ["", ATTRIBUTION]
    ref = commit_push(fichiers, "\n".join(corps) + "\n")
    log(f"commit {ref} poussé sur main")
    dep = A.deployer(log)
    resume(f"### Publication\n\nCommit `{ref}` sur main. {dep}\n")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="propose, contrôle, puis jette : ni commit, ni push, ni déploiement")
    ap.add_argument("--no-checks", action="store_true", help="essai local : sans les contrôles du dépôt")
    a = ap.parse_args()
    try:
        return run(a)
    except Exception as e:  # noqa: BLE001
        import traceback
        log("ERREUR : " + "".join(traceback.format_exception(e))[-2000:])
        resume(f"### Échec\n\n{e}\n")
        (ROOT / ".seo-echec.txt").write_text(str(e), encoding="utf-8")
        return 2


if __name__ == "__main__":
    sys.exit(main())
