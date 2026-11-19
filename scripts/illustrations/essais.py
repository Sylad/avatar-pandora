"""L63 — planche d'essais de la faune et des Na'vi (SDXL base 1.0 en local, texte seul).

Usage (machine avec GPU et le venv diffusers, cf. generer.py) :
    python essais.py <dossier> [--seul ikran toruk ...] [--planches]

Lit essais-faune.json : pour chaque créature, 4 variantes (graine notée, et pour les Na'vi un
cadrage propre à chaque variante). Les PNG sortent sous <dossier>/<id>-<n>-g<graine>.png, puis
une planche par créature (<dossier>/planche-<id>.png, grille 2×2, légende = graine + prompt
court) et une planche d'ensemble (<dossier>/planche-ensemble.png).
Avec --planches, ne régénère rien : refait seulement les planches à partir des PNG présents.
Rien n'est écrit dans le site : ces essais attendent le choix de Sylvain.

2e passe (D-2), avec --ip-adapter [--refs <dossier>] : SDXL + IP-Adapter SDXL (h94/IP-Adapter) ;
chaque créature reçoit ses images officielles de référence (champ « references », fichiers lus dans
<refs>/<id>/<nom de fichier de l'URL>, par défaut ~/projects/developpeur/tmp/l63-refs, JAMAIS dans le
dépôt) et ses 4 « variantes_ip » (graine × échelle IP-Adapter). Avant de charger l'adaptateur, la
variante retenue de la 1re passe (« passe1_retenue ») est régénérée à l'identique (même graine, même
prompt) pour la comparaison. Sorties : <id>-ip-<n>-g<graine>-e<échelle>.png, <id>-passe1.png,
planche-ip-<id>.png (1re passe en petit à gauche, puis la grille 2×2) et planche-ip-ensemble.png.
Les références ne figurent sur aucune planche.
"""
import json, os, sys, time, textwrap
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


# --- 2e passe : IP-Adapter -------------------------------------------------------------------

REFS = Path(os.path.expanduser("~/projects/developpeur/tmp/l63-refs"))


def nom_ip(c, i, v):
    return f"{c['id']}-ip-{i + 1}-g{v['graine']}-e{v['echelle']}.png"


def prompt_de(cfg, c, v):
    return v.get("prompt") or c["prompt"] + cfg["style"]


def references(c, refs):
    from PIL import Image
    ims = []
    for r in c["references"]:
        f = refs / c["id"] / r["image"].rsplit("/", 1)[1]
        if not f.exists():
            sys.exit(f"référence absente : {f} (télécharger {r['image']})")
        im = Image.open(f).convert("RGB")
        if r.get("masque"):  # [x0, y0, x1, y1] peint en blanc, coordonnées de l'image d'origine
            from PIL import ImageDraw
            ImageDraw.Draw(im).rectangle(r["masque"], fill="white")
        if r.get("recadrage"):  # [x0, y0, x1, y1] : écarte ce qui ne doit pas guider (cavalier…)
            im = im.crop(tuple(r["recadrage"]))
        ims.append(im)
    return ims


def generer_ip(cfg, out, seul, refs):
    import torch
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16,
        variant="fp16", use_safetensors=True).to("cuda")
    r = cfg["reglages"]
    choisies = [c for c in cfg["creatures"] if not seul or c["id"] in seul]

    def tirer(c, v, **ip):
        return pipe(prompt_de(cfg, c, v), negative_prompt=cfg["neg"] + ", " + c["neg"],
                    guidance_scale=r["guidance_scale"], num_inference_steps=r["num_inference_steps"],
                    width=c["largeur"], height=c["hauteur"],
                    generator=torch.Generator("cuda").manual_seed(v["graine"]), **ip).images[0]

    # 1re passe retenue, régénérée AVANT de charger l'adaptateur (texte seul, comme le 1er tour)
    for c in choisies:
        v = c["variantes"][c["passe1_retenue"]]
        tirer(c, v).save(out / f"{c['id']}-passe1.png")
        print(f"{c['id']}-passe1.png", flush=True)
    pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models",
                         weight_name="ip-adapter_sdxl.safetensors")
    for c in choisies:
        ims = references(c, refs)
        for i, v in enumerate(c["variantes_ip"]):
            t = time.time()
            pipe.set_ip_adapter_scale(v["echelle"])
            # une liste d'images pour l'unique adaptateur : leurs jetons sont concaténés
            tirer(c, v, ip_adapter_image=[ims]).save(out / nom_ip(c, i, v))
            print(nom_ip(c, i, v), round(time.time() - t, 1), "s", flush=True)


def ecrire(d, xy, texte, police, largeur, lignes_max, couleur="#cfe3ea", interligne=None):
    x, y = xy
    interligne = interligne or police.size + 5
    lignes = textwrap.wrap(texte, largeur)[:lignes_max]
    for j, ligne in enumerate(lignes):
        d.text((x, y + j * interligne), ligne, font=police, fill=couleur)
    return y + len(lignes) * interligne


def planche_ip(c, out, cellule=640):
    """1re passe retenue en petit à gauche, puis la grille 2×2 des variantes IP-Adapter, chacune
    légendée graine · échelle, jugement contre la description et ressemblance au film."""
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype(POLICE, 18)
    fg = ImageFont.truetype(POLICE_GRAS, 19)
    ft = ImageFont.truetype(POLICE_GRAS, 30)
    vignettes = []
    for i, v in enumerate(c["variantes_ip"]):
        im = Image.open(out / nom_ip(c, i, v)).convert("RGB")
        im.thumbnail((cellule, cellule))
        vignettes.append((im, v))
    w = max(im.width for im, _ in vignettes)
    h = max(im.height for im, _ in vignettes)
    p1 = Image.open(out / f"{c['id']}-passe1.png").convert("RGB")
    p1.thumbnail((300, 300))
    leg, marge, titre, gauche = 230, 16, 60, p1.width + 32
    page = Image.new("RGB", (gauche + 2 * w + 3 * marge, titre + 2 * (h + leg) + 2 * marge), "#10161c")
    d = ImageDraw.Draw(page)
    d.text((marge, 14), f"L63 — 2e passe IP-Adapter : {c['id']}  ({c['fiche']})", font=ft, fill="#e8f4f8")
    v1 = c["variantes"][c["passe1_retenue"]]
    page.paste(p1, (marge, titre))
    y = ecrire(d, (marge, titre + p1.height + 8), "1re passe, texte seul", fg, 22, 1, "#e8f4f8")
    ecrire(d, (marge, y + 2), f"#{c['passe1_retenue'] + 1} graine {v1['graine']}", f, 28, 1)
    d.line([(gauche - 8, titre), (gauche - 8, page.height - marge)], fill="#3a4a55", width=2)
    for k, (im, v) in enumerate(vignettes):
        x = gauche + marge + (k % 2) * (w + marge)
        y = titre + (k // 2) * (h + leg + marge)
        page.paste(im, (x, y))
        col = max(30, w // 10)
        tete = f"#{k + 1}  graine {v['graine']} · échelle {v['echelle']}"
        if v.get("cadrage"):
            tete += f" · {v['cadrage']}"
        tete += f" — ressemble au film : {v['ressemble_film'] or '?'}"
        yy = ecrire(d, (x, y + h + 6), tete, fg, col, 2, "#e8f4f8")
        if v.get("decalque"):
            yy = ecrire(d, (x, yy), "trop proche de la référence (décalque) : " + v["decalque"], f, col + 4, 2, "#ffb86b")
        ecrire(d, (x, yy), v["jugement"], f, col + 4, 6)
    chemin = out / f"planche-ip-{c['id']}.png"
    page.save(chemin)
    return chemin


def ensemble_ip(cfg, out):
    """Une rangée par créature : la 1re passe retenue, un séparateur, puis les 4 variantes IP-Adapter."""
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype(POLICE_GRAS, 26)
    fs = ImageFont.truetype(POLICE, 17)
    hauteur, marge, gauche = 260, 10, 170
    rangs = []
    for c in cfg["creatures"]:
        ims = [(Image.open(out / f"{c['id']}-passe1.png").convert("RGB"), None)]
        ims += [(Image.open(out / nom_ip(c, i, v)).convert("RGB"), v) for i, v in enumerate(c["variantes_ip"])]
        rangs.append((c, [(im.resize((round(im.width * hauteur / im.height), hauteur)), v) for im, v in ims]))
    largeur = gauche + max(sum(im.width + marge for im, _ in ims) + 20 for _, ims in rangs) + marge
    page = Image.new("RGB", (largeur, 70 + len(rangs) * (hauteur + 52 + marge)), "#10161c")
    d = ImageDraw.Draw(page)
    d.text((marge, 18), "L63 — 2e passe : SDXL + IP-Adapter (références officielles), 1re passe à gauche",
           font=ImageFont.truetype(POLICE_GRAS, 32), fill="#e8f4f8")
    y = 70
    for c, ims in rangs:
        d.text((marge, y + hauteur // 2 - 14), c["id"], font=f, fill="#e8f4f8")
        x = gauche
        for k, (im, v) in enumerate(ims):
            page.paste(im, (x, y))
            if v is None:
                lignes = ["1re passe, texte seul"]
            else:
                lignes = [f"#{k} g{v['graine']} · éch. {v['echelle']}", f"film : {v['ressemble_film'] or '?'}"]
                if im.width >= 300:
                    lignes = [" · ".join(lignes)]
            for j, ligne in enumerate(lignes):
                d.text((x, y + hauteur + 6 + j * 20), ligne, font=fs, fill="#cfe3ea")
            x += im.width + marge
            if v is None:
                d.line([(x + 4, y), (x + 4, y + hauteur)], fill="#3a4a55", width=3)
                x += 20
        y += hauteur + 52 + marge
    chemin = out / "planche-ip-ensemble.png"
    page.save(chemin)
    return chemin


def main():
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    cfg = json.loads((ICI / "essais-faune.json").read_text())
    args = sys.argv[2:]
    refs = REFS
    if "--refs" in args:
        k = args.index("--refs")
        refs = Path(args[k + 1]).expanduser()
        del args[k:k + 2]
    seul = {a for a in args if not a.startswith("--")} if "--seul" in args else None
    if "--ip-adapter" in args:
        if "--planches" not in args:
            generer_ip(cfg, out, seul, refs)
        for c in cfg["creatures"]:
            print(planche_ip(c, out))
        print(ensemble_ip(cfg, out))
        return
    if "--planches" not in args:
        generer(cfg, out, seul)
    for c in cfg["creatures"]:
        print(planche(c, out))
    print(ensemble(cfg, out))


if __name__ == "__main__":
    main()
