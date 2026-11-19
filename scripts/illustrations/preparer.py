"""L17 — convertit les PNG retenus en WebP du site et renseigne les fiches.

Usage : python preparer.py <dossier-png>     (Pillow avec WebP)

Pour chaque entrée de illustrations.json (<dossier-png>/<section>-<fiche>.png, 1344×768) :
  frontend/public/illustrations/<section>/<fiche>.webp        bandeau de fiche, 1344×576 (21:9)
  frontend/public/illustrations/<section>/<fiche>-carte.webp  carte de liste, 640×480 (4:3)
et écrit `cover` + `coverAlt` (texte alternatif français) dans le front matter de la fiche.
Le recadrage garde le centre (ou la hauteur `cadre` de l'entrée : 0 = haut, 1 = bas).
Dimensions : src/lib/cover.ts (ILLUSTRATION_SIZES) ; contrôle : scripts/illustrations.test.mjs.
"""
import json, re, sys
from pathlib import Path
from PIL import Image

ICI = Path(__file__).parent
FRONT = ICI.parent.parent / "frontend"
TAILLES = {"": (1344, 576, 80), "-carte": (640, 480, 78)}


def recadre(img, w, h, cadre):
    ratio = w / h
    W, H = img.size
    if W / H > ratio:
        cw, ch = round(H * ratio), H
    else:
        cw, ch = W, round(W / ratio)
    x = (W - cw) // 2
    y = round((H - ch) * cadre)
    return img.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)


def renseigne(md, cover, alt):
    texte = md.read_text()
    tete, corps = texte.split("\n---\n", 1)
    tete = re.sub(r'^coverAlt:.*\n?', "", tete + "\n", flags=re.M).rstrip("\n")
    tete = re.sub(r'^cover:.*$', f'cover: "{cover}"\ncoverAlt: "{alt}"', tete, flags=re.M)
    md.write_text(tete + "\n---\n" + corps)


def main():
    src = Path(sys.argv[1])
    for e in json.loads((ICI / "illustrations.json").read_text()):
        section, fiche = e["fiche"].split("/")
        img = Image.open(src / f"{section}-{fiche}.png").convert("RGB")
        dest = FRONT / "public/illustrations" / section
        dest.mkdir(parents=True, exist_ok=True)
        for suffixe, (w, h, q) in TAILLES.items():
            recadre(img, w, h, e.get("cadre", 0.5)).save(dest / f"{fiche}{suffixe}.webp", "WEBP", quality=q, method=6)
        renseigne(FRONT / "src/content" / section / f"{fiche}.md", f"/illustrations/{section}/{fiche}.webp", e["alt"])
        print(e["fiche"])


if __name__ == "__main__":
    main()
