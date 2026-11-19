"""L17 — convertit les PNG retenus en WebP du site et renseigne les fiches.

Usage : python preparer.py <dossier-png> [--seul bestiaire/ikran ...]     (Pillow avec WebP)

Pour chaque entrée de illustrations.json (<dossier-png>/<section>-<fiche>.png, 1344×768) :
  frontend/public/illustrations/<section>/<fiche>.webp        bandeau de fiche, 1344×576 (21:9)
  frontend/public/illustrations/<section>/<fiche>-carte.webp  carte de liste, 640×480 (4:3)
et écrit `cover` + `coverAlt` (texte alternatif français) dans le front matter de la fiche.
Une entrée `"branchee": false` (tout le bestiaire depuis le 19-11-2026, L63) est gardée pour être refaite
mais n'est pas posée sur sa fiche : passer `branchee` à true (ou retirer le champ) pour la rebrancher.
Le recadrage garde le centre (ou la hauteur `cadre` de l'entrée : 0 = haut, 1 = bas ; et la position
horizontale `cadre_x`, 0 = gauche, 1 = droite, utile pour la carte 4:3 quand la tête est au bord).
Dimensions : src/lib/cover.ts (ILLUSTRATION_SIZES) ; contrôle : scripts/illustrations.test.mjs.
"""
import json, re, sys
from pathlib import Path
from PIL import Image

ICI = Path(__file__).parent
FRONT = ICI.parent.parent / "frontend"
TAILLES = {"": (1344, 576, 80), "-carte": (640, 480, 78)}


def recadre(img, w, h, cadre, cadre_x=0.5):
    ratio = w / h
    W, H = img.size
    if W / H > ratio:
        cw, ch = round(H * ratio), H
    else:
        cw, ch = W, round(W / ratio)
    x = round((W - cw) * cadre_x)
    y = round((H - ch) * cadre)
    return img.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)


def renseigne(md, cover, alt):
    texte = md.read_text()
    tete, corps = texte.split("\n---\n", 1)
    tete = re.sub(r'^coverAlt:.*\n?', "", tete + "\n", flags=re.M).rstrip("\n")
    ligne = f'cover: "{cover}"\ncoverAlt: "{alt}"'
    if re.search(r'^cover:', tete, flags=re.M):
        tete = re.sub(r'^cover:.*$', ligne, tete, flags=re.M)
    else:
        tete += "\n" + ligne
    md.write_text(tete + "\n---\n" + corps)


def main():
    src = Path(sys.argv[1])
    seul = set(sys.argv[sys.argv.index("--seul") + 1:]) if "--seul" in sys.argv else None
    for e in json.loads((ICI / "illustrations.json").read_text()):
        if seul and e["fiche"] not in seul:
            continue
        if e.get("branchee") is False:
            print(f'{e["fiche"]} : non branchée, ignorée')
            continue
        section, fiche = e["fiche"].split("/")
        img = Image.open(src / f"{section}-{fiche}.png").convert("RGB")
        dest = FRONT / "public/illustrations" / section
        dest.mkdir(parents=True, exist_ok=True)
        for suffixe, (w, h, q) in TAILLES.items():
            recadre(img, w, h, e.get("cadre", 0.5), e.get("cadre_x", 0.5)).save(dest / f"{fiche}{suffixe}.webp", "WEBP", quality=q, method=6)
        renseigne(FRONT / "src/content" / section / f"{fiche}.md", f"/illustrations/{section}/{fiche}.webp", e["alt"])
        print(e["fiche"])


if __name__ == "__main__":
    main()
