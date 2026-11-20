"""L63 (D-2, D-3), L64 (D-4) — images officielles des films pour TOUTES les fiches illustrées du codex
(bestiaire, Pandora, clans, flore, films, engins, personnages), crédit discret « © 20th Century Studios ».

Usage : python films.py <dossier-refs> [--seul bestiaire/ikran ...] [--planche <fichier.jpg>]
        (Pillow ; opencv-python-headless pour les plans tirés de la vidéo)

<dossier-refs> : dossier des images sources, hors du dépôt (chez Sylvain : ~/projects/developpeur/tmp/l63-refs/).
Rien de ce dossier n'est versionné : seules les deux tailles WebP retenues sont servies par le site.

Pour chaque entrée de films.json :
  frontend/public/illustrations/<section>/<fiche>.webp        bandeau de fiche, 1344×576 (21:9)
  frontend/public/illustrations/<section>/<fiche>-carte.webp  carte de liste, 640×480 (4:3)
et écrit `cover`, `coverAlt` et `coverCredit` dans le front matter de la fiche.

Champs d'une entrée (la traçabilité est contrôlée par scripts/illustrations.test.mjs) :
  source  : {"type": "sylvain", "fichier": …}          image du film fournie par Sylvain
            {"type": "pandorapedia", "image": URL, "page": URL, "fichier": …}  image officielle
            {"type": "video", "fichier": …, "temps": secondes}                 plan de la vidéo fournie
            {"type": "film", "image": URL, "page": URL avatar.com/movies/…, "fichier": …}
                                                     plan officiel de la page du film (L64)
            "fond_blanc": true  image officielle sur fond blanc (portraits, engins de Pandorapedia) :
                                le blanc relié aux bords est remplacé par "fond" (défaut #0a0a1f),
                                le blanc à l'intérieur du sujet (chemise, reflets) est gardé,
            "trous": true  sauf le blanc pur enfermé dans le sujet (verrière d'un engin).
  credit  : « © 20th Century Studios », affiché en légende de l'image.
  bandeau / carte : réglage de chaque taille —
            "zone": [x0, y0, x1, y1]  partie de l'image gardée (défaut : toute l'image)
            "mode": "couvrir"   recadre au format (position "cadre" 0..1 vertical, "cadre_x" horizontal)
                    "contenir"  garde toute la zone ; le reste du format est rempli par la même image
                                floutée et assombrie (ou par "fond" : celui de l'entrée pour une image
                                détourée, ou celui du réglage de la taille).
  fond    : couleur posée sous une image détourée (PNG transparent).
  serrer  : true recadre sur le sujet posé sur fond uni (engins de Pandorapedia), sauf "zone" donnée.
  masquer : rectangles adoucis (flou fondu) — ex. le nageur que Sylvain a flouté sur le tulkun.
  Une fiche peut garder une entrée refusée ET une entrée retenue (akula, nantang, hexapede : plan de
  vidéo refusé le 20-11, image officielle de Pandorapedia retenue en L64).
  La page Pandorapedia de la source est écrite dans le champ `pandorapedia` de la fiche si elle n'en a pas.
  retenue : false pour une image refusée (avec "raison") : l'entrée garde sa traçabilité mais n'est
            jamais posée ; la fiche garde le visuel par défaut (akula, nantang, hexapede le 20-11).
  sha256  : {"bandeau": …, "carte": …} empreinte des deux WebP servis, réécrite par ce script à chaque
            génération ; R13 de scripts/illustrations.test.mjs la compare aux fichiers, si bien qu'un WebP
            remplacé sans passer par films.json fait échouer les tests.
"""
import hashlib, json, re, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageEnhance, ImageFont

ICI = Path(__file__).parent
FRONT = ICI.parent.parent / "frontend"
TAILLES = {"bandeau": ("", 1344, 576, 82), "carte": ("-carte", 640, 480, 80)}


def charge(refs, e):
    s = e["source"]
    if s["type"] == "video":
        import cv2
        c = cv2.VideoCapture(str(refs / s["fichier"]))
        c.set(cv2.CAP_PROP_POS_MSEC, float(s["temps"]) * 1000)
        ok, f = c.read()
        if not ok:
            raise SystemExit(f'{e["fiche"]} : plan illisible à {s["temps"]} s')
        return Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
    img = Image.open(refs / s["fichier"])
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        fond = Image.new("RGBA", img.size, e.get("fond", "#0a0a1f"))
        fond.alpha_composite(img)
        img = fond
    img = img.convert("RGB")
    if s.get("fond_blanc"):
        img = sans_fond_blanc(img, e.get("fond", "#0a0a1f"), trous=s.get("trous", False))
    return img


def sans_fond_blanc(img, fond, seuil=236, trous=False):
    """Remplace le fond blanc relié aux bords par `fond`, bord adouci sans liseré clair."""
    r, g, b = img.split()
    mini = ImageChops.darker(ImageChops.darker(r, g), b)
    masque = mini.point(lambda v: 255 if v >= seuil else 0)
    W, H = masque.size
    px = masque.load()
    for x in range(0, W, 8):
        for y in (0, H - 1):
            if px[x, y] == 255:
                ImageDraw.floodfill(masque, (x, y), 128)
    for y in range(0, H, 8):
        for x in (0, W - 1):
            if px[x, y] == 255:
                ImageDraw.floodfill(masque, (x, y), 128)
    fondmasque = masque.point(lambda v: 255 if v == 128 else 0)
    if trous:  # engins : le fond vu à travers une verrière ou entre deux pièces, blanc pur, part aussi
        fondmasque = ImageChops.lighter(fondmasque, mini.point(lambda v: 255 if v >= 248 else 0))
    fondmasque = fondmasque.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    return Image.composite(Image.new("RGB", img.size, fond), img, fondmasque)


def adoucit(img, rects):
    for x0, y0, x1, y1 in rects:
        m = 40
        zone = (max(0, x0 - 3 * m), max(0, y0 - 3 * m), min(img.width, x1 + 3 * m), min(img.height, y1 + 3 * m))
        flou = img.crop(zone).filter(ImageFilter.GaussianBlur(45))
        masque = Image.new("L", flou.size, 0)
        ImageDraw.Draw(masque).rectangle((x0 - zone[0] - m // 2, y0 - zone[1] - m // 2, x1 - zone[0] + m // 2, y1 - zone[1] + m // 2), fill=255)
        img.paste(flou, zone[:2], masque.filter(ImageFilter.GaussianBlur(m // 2)))
    return img


def couvre(img, w, h, cadre=0.5, cadre_x=0.5):
    ratio = w / h
    W, H = img.size
    cw, ch = (round(H * ratio), H) if W / H > ratio else (W, round(W / ratio))
    x, y = round((W - cw) * cadre_x), round((H - ch) * cadre)
    return img.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)


def contient(img, w, h, fond=None):
    if fond:
        bas = Image.new("RGB", (w, h), fond)
    else:
        bas = couvre(img, w, h).filter(ImageFilter.GaussianBlur(28))
        bas = ImageEnhance.Brightness(bas).enhance(0.45)
    k = min(w / img.width, h / img.height)
    petit = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    bas.paste(petit, ((w - petit.width) // 2, (h - petit.height) // 2))
    return bas


def serre(img, fond, marge=0.08):
    """Recadre sur le sujet posé sur un fond uni (engin détouré), avec une marge."""
    diff = ImageChops.difference(img, Image.new("RGB", img.size, fond)).convert("L").point(lambda v: 255 if v > 24 else 0)
    x0, y0, x1, y1 = diff.getbbox() or (0, 0, *img.size)
    m = round(max(x1 - x0, y1 - y0) * marge)
    return img.crop((max(0, x0 - m), max(0, y0 - m), min(img.width, x1 + m), min(img.height, y1 + m)))


def taille(img, e, quoi, w, h):
    r = e.get(quoi, {})
    if "zone" in r:
        img = img.crop(tuple(r["zone"]))
    elif e.get("serrer"):
        img = serre(img, e.get("fond", "#0a0a1f"))
    if r.get("mode") == "contenir":
        s = e["source"]
        return contient(img, w, h, r.get("fond") or (e.get("fond", "#0a0a1f") if s.get("detouree") or s.get("fond_blanc") else None))
    return couvre(img, w, h, r.get("cadre", 0.5), r.get("cadre_x", 0.5))


def renseigne(md, champs):
    texte = md.read_text()
    tete, corps = texte.split("\n---\n", 1)
    for k, v in champs.items():
        if k == "pandorapedia" and re.search(r"^pandorapedia:", tete, flags=re.M):
            continue
        ligne = f'{k}: "{v}"'
        if re.search(rf"^{k}:", tete, flags=re.M):
            tete = re.sub(rf"^{k}:.*$", ligne, tete, flags=re.M)
        else:
            tete += "\n" + ligne
    md.write_text(tete + "\n---\n" + corps)


def main():
    refs = Path(sys.argv[1]).expanduser()
    seul = None
    if "--seul" in sys.argv:
        seul = {a for a in sys.argv[sys.argv.index("--seul") + 1:] if not a.startswith("--")}
    planche = sys.argv[sys.argv.index("--planche") + 1] if "--planche" in sys.argv else None
    vignettes = []
    entrees = json.loads((ICI / "films.json").read_text())
    for e in entrees:
        if seul and e["fiche"] not in seul:
            continue
        if e.get("retenue") is False:
            continue
        section, fiche = e["fiche"].split("/")
        img = adoucit(charge(refs, e), e.get("masquer", []))
        dest = FRONT / "public/illustrations" / section
        dest.mkdir(parents=True, exist_ok=True)
        for quoi, (suffixe, w, h, q) in TAILLES.items():
            out = taille(img, e, quoi, w, h)
            fichier = dest / f"{fiche}{suffixe}.webp"
            out.save(fichier, "WEBP", quality=q, method=6)
            e.setdefault("sha256", {})[quoi] = hashlib.sha256(fichier.read_bytes()).hexdigest()
            if quoi == "carte":
                vignettes.append((e["fiche"], out))
        champs = {"cover": f"/illustrations/{section}/{fiche}.webp", "coverAlt": e["alt"], "coverCredit": e["credit"]}
        if e["source"]["type"] == "pandorapedia":
            champs["pandorapedia"] = e["source"]["page"]
        renseigne(FRONT / "src/content" / section / f"{fiche}.md", champs)
        print(e["fiche"])
    (ICI / "films.json").write_text(json.dumps(entrees, indent=2, ensure_ascii=False) + "\n")
    if planche and vignettes:
        cols = 4
        lignes = (len(vignettes) + cols - 1) // cols
        p = Image.new("RGB", (cols * 660, lignes * 530), "#0a0a1f")
        d = ImageDraw.Draw(p)
        try:
            police = ImageFont.truetype("DejaVuSans.ttf", 22)
        except OSError:
            police = ImageFont.load_default()
        for i, (nom, v) in enumerate(vignettes):
            x, y = (i % cols) * 660 + 10, (i // cols) * 530 + 10
            p.paste(v, (x, y))
            d.text((x, y + 486), nom, fill="#e8e6dd", font=police)
        p.save(planche, quality=88)


if __name__ == "__main__":
    main()
