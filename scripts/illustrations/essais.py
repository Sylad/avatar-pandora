"""L63 — planche d'essais de la faune et des Na'vi (SDXL base 1.0 en local, texte seul).

Usage (machine avec GPU et le venv diffusers, cf. generer.py) :
    python essais.py <dossier> [--seul ikran toruk ...] [--planches]

Lit essais-faune.json : pour chaque créature, 4 variantes (graine notée, et pour les Na'vi un
cadrage propre à chaque variante). Les PNG sortent sous <dossier>/<id>-<n>-g<graine>.png, puis
une planche par créature (<dossier>/planche-<id>.png, grille 2×2, légende = graine + prompt
court) et une planche d'ensemble (<dossier>/planche-ensemble.png).
Avec --planches, ne régénère rien : refait seulement les planches à partir des PNG présents.
Rien n'est écrit dans le site : ces essais attendent le choix de Sylvain.
"""
import json, sys, time, textwrap
from pathlib import Path

ICI = Path(__file__).parent
POLICE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
POLICE_GRAS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def nom(c, i, v):
    return f"{c['id']}-{i + 1}-g{v['graine']}.png"


def generer(cfg, out, seul):
    import torch
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16,
        variant="fp16", use_safetensors=True).to("cuda")
    r = cfg["reglages"]
    for c in cfg["creatures"]:
        if seul and c["id"] not in seul:
            continue
        for i, v in enumerate(c["variantes"]):
            t = time.time()
            img = pipe(v.get("prompt") or c["prompt"] + cfg["style"],
                       negative_prompt=cfg["neg"] + ", " + c["neg"],
                       guidance_scale=r["guidance_scale"], num_inference_steps=r["num_inference_steps"],
                       width=c["largeur"], height=c["hauteur"],
                       generator=torch.Generator("cuda").manual_seed(v["graine"])).images[0]
            img.save(out / nom(c, i, v))
            print(nom(c, i, v), round(time.time() - t, 1), "s", flush=True)


def planche(c, out, cellule=640):
    """Grille 2×2 des variantes, chaque image légendée « graine — prompt court »."""
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype(POLICE, 20)
    ft = ImageFont.truetype(POLICE_GRAS, 30)
    vignettes = []
    for i, v in enumerate(c["variantes"]):
        im = Image.open(out / nom(c, i, v)).convert("RGB")
        im.thumbnail((cellule, cellule))
        vignettes.append((im, v))
    w = max(im.width for im, _ in vignettes)
    h = max(im.height for im, _ in vignettes)
    leg, marge, titre = 64, 16, 60
    page = Image.new("RGB", (2 * w + 3 * marge, titre + 2 * (h + leg) + 2 * marge), "#10161c")
    d = ImageDraw.Draw(page)
    d.text((marge, 14), f"L63 — essais : {c['id']}  ({c['fiche']})", font=ft, fill="#e8f4f8")
    for k, (im, v) in enumerate(vignettes):
        x = marge + (k % 2) * (w + marge)
        y = titre + (k // 2) * (h + leg + marge)
        page.paste(im, (x, y))
        texte = f"#{k + 1}  graine {v['graine']}" + (f" · {v['cadrage']}" if v.get("cadrage") else "")
        texte += " — " + (v.get("prompt_court") or c["prompt_court"])
        for j, ligne in enumerate(textwrap.wrap(texte, max(24, w // 11))[:2]):
            d.text((x, y + h + 6 + j * 26), ligne, font=f, fill="#cfe3ea")
    chemin = out / f"planche-{c['id']}.png"
    page.save(chemin)
    return chemin


def ensemble(cfg, out):
    """Une rangée par créature, ses 4 variantes côte à côte, nom à gauche."""
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype(POLICE_GRAS, 26)
    fs = ImageFont.truetype(POLICE, 17)
    hauteur, marge, gauche = 260, 10, 170
    rangs = []
    for c in cfg["creatures"]:
        ims = []
        for i, v in enumerate(c["variantes"]):
            im = Image.open(out / nom(c, i, v)).convert("RGB")
            im = im.resize((round(im.width * hauteur / im.height), hauteur))
            ims.append((im, v))
        rangs.append((c, ims))
    largeur = gauche + max(sum(im.width + marge for im, _ in ims) for _, ims in rangs) + marge
    page = Image.new("RGB", (largeur, 70 + len(rangs) * (hauteur + 52 + marge)), "#10161c")
    d = ImageDraw.Draw(page)
    d.text((marge, 18), "L63 — planche d'ensemble des essais (SDXL base 1.0 en local)",
           font=ImageFont.truetype(POLICE_GRAS, 32), fill="#e8f4f8")
    y = 70
    for c, ims in rangs:
        d.text((marge, y + hauteur // 2 - 14), c["id"], font=f, fill="#e8f4f8")
        x = gauche
        for k, (im, v) in enumerate(ims):
            page.paste(im, (x, y))
            lignes = [f"#{k + 1} graine {v['graine']}"] + ([v["cadrage"]] if v.get("cadrage") else [])
            if im.width >= 300:
                lignes = [" · ".join(lignes)]
            for j, ligne in enumerate(lignes):
                d.text((x, y + hauteur + 6 + j * 20), ligne, font=fs, fill="#cfe3ea")
            x += im.width + marge
        y += hauteur + 52 + marge
    chemin = out / "planche-ensemble.png"
    page.save(chemin)
    return chemin


def main():
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    cfg = json.loads((ICI / "essais-faune.json").read_text())
    seul = {a for a in sys.argv[2:] if not a.startswith("--")} if "--seul" in sys.argv else None
    if "--planches" not in sys.argv:
        generer(cfg, out, seul)
    for c in cfg["creatures"]:
        print(planche(c, out))
    print(ensemble(cfg, out))


if __name__ == "__main__":
    main()
