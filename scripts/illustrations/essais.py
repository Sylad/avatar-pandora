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

3e passe (D-2), avec --ip3 [--refs <dossier>] [--seul toruk tulkun] : seules les créatures qui portent
un bloc « passe3 » (toruk, tulkun). Description anatomique corrigée d'après des images des films
fournies par Sylvain ; chaque variante choisit ses références (« refs », indices dans
passe3.references, au moins une image de Sylvain) et sa scène (pose et décor différents des
références). Une référence est soit une URL Pandorapedia (fichier = nom de l'URL), soit un « fichier »
fourni par Sylvain, lu dans <refs>/<id>/ ; « flou » floute des zones (cavalier, autre créature, navire)
et « recadrage » la cadre en carré, car l'encodeur CLIP d'IP-Adapter recadre au centre en carré
(224 px) : sans cela, la queue ou la tête sortaient du champ. Les 4 variantes de la 2e passe sont
d'abord régénérées à l'identique pour la comparaison. Sorties : <id>-ip3-<n>-g<graine>-e<échelle>.png
et planche-ip3-<id>.png (2e passe en petit à gauche, puis la grille 2×2).

Essai ControlNet (D-2), avec --controlnet [--refs <dossier>] : seules les créatures qui portent un
bloc « passe_cn » (toruk). SDXL + ControlNet canny SDXL (diffusers/controlnet-canny-sdxl-1.0, libre,
sans jeton) + IP-Adapter. La carte de contrôle (« carte ») est faite des bords Canny d'une image du
film fournie par Sylvain, limités à un polygone autour du sujet : les autres créatures et le décor
n'y sont pas, seule la silhouette est contrainte ; elle est mise en miroir et posée sur fond noir,
puis enregistrée en <id>-cn-carte.png dans le dossier de sortie (jamais dans le dépôt ni sur une
planche). 4 variantes graine × poids du ControlNet, décor différent de la référence. La variante
« precedente » de la 3e passe est d'abord régénérée à l'identique (même UNet et même adaptateur,
sans ControlNet). Sorties : <id>-cn-<n>-g<graine>-p<poids>.png et planche-cn-<id>.png (3e passe en
petit à gauche, puis la grille 2×2 jugée : tête séparée, crête bleue, ressemblance, décalque).
Dépendance en plus : opencv-python-headless.
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


def charger_ref(c, r, refs):
    """Une image de référence, lue hors du dépôt, floutée, masquée et recadrée selon « r »."""
    from PIL import Image, ImageDraw, ImageFilter
    f = refs / c["id"] / (r.get("fichier") or r["image"].rsplit("/", 1)[1])
    if not f.exists():
        sys.exit(f"référence absente : {f} ({r.get('image') or r.get('source')})")
    im = Image.open(f).convert("RGB")
    for zone in r.get("flou", []):  # [x0, y0, x1, y1] : flou fort, sans tache blanche
        zone = tuple(zone)
        im.paste(im.crop(zone).filter(ImageFilter.GaussianBlur(40)), zone[:2])
    if r.get("masque"):
        ImageDraw.Draw(im).rectangle(r["masque"], fill="white")
    if r.get("recadrage"):
        im = im.crop(tuple(r["recadrage"]))
    return im


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


# --- 3e passe : description corrigée, images des films fournies par Sylvain ------------------

def nom_ip3(c, i, v):
    return f"{c['id']}-ip3-{i + 1}-g{v['graine']}-e{v['echelle']}.png"


def prompt_ip3(cfg, c, v):
    return f"{v['scene']}, {v.get('corps') or c['passe3']['corps']}" + cfg["style"]


def generer_ip3(cfg, out, seul, refs):
    import torch
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16,
        variant="fp16", use_safetensors=True).to("cuda")
    pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models",
                         weight_name="ip-adapter_sdxl.safetensors")
    r = cfg["reglages"]
    choisies = [c for c in cfg["creatures"] if "passe3" in c and (not seul or c["id"] in seul)]

    def tirer(prompt, neg, c, v, ims):
        pipe.set_ip_adapter_scale(v["echelle"])
        return pipe(prompt, negative_prompt=neg, guidance_scale=r["guidance_scale"],
                    num_inference_steps=r["num_inference_steps"], width=c["largeur"], height=c["hauteur"],
                    generator=torch.Generator("cuda").manual_seed(v["graine"]),
                    ip_adapter_image=[ims]).images[0]

    for c in choisies:
        # 2e passe régénérée à l'identique (mêmes références, prompt, graine et échelle)
        ims2 = references(c, refs)
        for i, v in enumerate(c["variantes_ip"]):
            tirer(prompt_de(cfg, c, v), cfg["neg"] + ", " + c["neg"], c, v, ims2).save(out / nom_ip(c, i, v))
            print(nom_ip(c, i, v), flush=True)
        p3 = c["passe3"]
        for i, v in enumerate(p3["variantes"]):
            t = time.time()
            ims = [charger_ref(c, p3["references"][k], refs) for k in v["refs"]]
            tirer(prompt_ip3(cfg, c, v), cfg["neg"] + ", " + p3["neg"], c, v, ims).save(out / nom_ip3(c, i, v))
            print(nom_ip3(c, i, v), round(time.time() - t, 1), "s", flush=True)


def planche_ip3(c, out, cellule=640):
    """2e passe (4 variantes) en petit à gauche, puis la grille 2×2 de la 3e passe, chaque variante
    légendée graine · échelle · références, ressemblance au film et jugement d'une ligne."""
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype(POLICE, 18)
    fs = ImageFont.truetype(POLICE, 15)
    fg = ImageFont.truetype(POLICE_GRAS, 19)
    ft = ImageFont.truetype(POLICE_GRAS, 30)
    p3 = c["passe3"]
    vignettes = []
    for i, v in enumerate(p3["variantes"]):
        im = Image.open(out / nom_ip3(c, i, v)).convert("RGB")
        im.thumbnail((cellule, cellule))
        vignettes.append((im, v))
    w = max(im.width for im, _ in vignettes)
    h = max(im.height for im, _ in vignettes)
    leg, marge, titre = 170, 16, 60
    petites = []
    for i, v in enumerate(c["variantes_ip"]):
        im = Image.open(out / nom_ip(c, i, v)).convert("RGB")
        im.thumbnail((260, 260))
        petites.append((im, v))
    gauche = max(im.width for im, _ in petites) + 2 * marge + 8
    hauteur = max(titre + 2 * (h + leg) + 2 * marge, titre + 40 + sum(im.height + 44 for im, _ in petites))
    page = Image.new("RGB", (gauche + 2 * w + 3 * marge, hauteur), "#10161c")
    d = ImageDraw.Draw(page)
    d.text((marge, 14), f"L63 — 3e passe IP-Adapter (images des films fournies par Sylvain) : {c['id']}"
           f"  ({c['fiche']})", font=ft, fill="#e8f4f8")
    y = ecrire(d, (marge, titre), "2e passe (références Pandorapedia)", fg, 22, 2, "#e8f4f8")
    for k, (im, v) in enumerate(petites):
        page.paste(im, (marge, y + 4))
        y = ecrire(d, (marge, y + im.height + 6), f"#{k + 1} g{v['graine']} · éch. {v['echelle']} · film : "
                   f"{v['ressemble_film']}", fs, 40, 1) + 14
    d.line([(gauche - 8, titre), (gauche - 8, page.height - marge)], fill="#3a4a55", width=2)
    for k, (im, v) in enumerate(vignettes):
        x = gauche + marge + (k % 2) * (w + marge)
        y = titre + (k // 2) * (h + leg + marge)
        page.paste(im, (x, y))
        col = max(30, w // 10)
        refs_txt = ", ".join(p3["references"][i]["court"] for i in v["refs"])
        tete = (f"#{k + 1}  graine {v['graine']} · échelle {v['echelle']} — ressemble au film : "
                f"{v['ressemble_film'] or '?'}")
        yy = ecrire(d, (x, y + h + 6), tete, fg, col, 2, "#e8f4f8")
        yy = ecrire(d, (x, yy), f"{v['scene_courte']} · réf. : {refs_txt}", fs, col + 12, 3, "#9fb8c2")
        if v.get("decalque"):
            yy = ecrire(d, (x, yy), "trop proche de la référence : " + v["decalque"], f, col + 4, 2, "#ffb86b")
        ecrire(d, (x, yy), v["jugement"], f, col + 4, 3)
    chemin = out / f"planche-ip3-{c['id']}.png"
    page.save(chemin)
    return chemin


# --- Essai ControlNet : silhouette imposée (toruk) -------------------------------------------

def nom_cn(c, i, v):
    return f"{c['id']}-cn-{i + 1}-g{v['graine']}-p{v['poids']}.png"


def carte_cn(c, refs):
    """Carte de bords Canny du seul sujet : bords de la référence limités au polygone qui l'entoure
    (les autres créatures et le décor restent dehors), petites composantes retirées, boîte du
    polygone en miroir si demandé, posée sur fond noir à la taille de la génération."""
    import cv2
    import numpy as np
    from PIL import Image
    k = c["passe_cn"]["carte"]
    r = c["passe3"]["references"][k["reference"]]
    f = refs / c["id"] / r["fichier"]
    if not f.exists():
        sys.exit(f"référence absente : {f} ({r['source']})")
    im = cv2.imread(str(f))
    poly = np.array(k["polygone"], np.float64)
    x, y, w, h = cv2.boundingRect(poly.astype(np.int32))
    L, H = c["largeur"], c["hauteur"]
    e = min(H * k["hauteur_relative"] / h, L * 0.95 / w)
    sujet = cv2.resize(im[y:y + h, x:x + w], (round(w * e), round(h * e)), interpolation=cv2.INTER_AREA)
    poly = (poly - (x, y)) * e
    if k.get("miroir"):
        sujet = sujet[:, ::-1].copy()
        poly[:, 0] = sujet.shape[1] - 1 - poly[:, 0]
    # Canny à la taille de la génération : traits d'un pixel, comme l'entraînement du ControlNet
    masque = np.zeros(sujet.shape[:2], np.uint8)
    cv2.fillPoly(masque, [poly.round().astype(np.int32)], 255)
    bords = cv2.Canny(cv2.GaussianBlur(sujet, (3, 3), 0), *k["canny"])
    bords[masque == 0] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(bords, connectivity=8)
    garde = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= k["aire_min"]])
    page = Image.new("L", (L, H), 0)
    sw, sh = sujet.shape[1], sujet.shape[0]
    x0 = min(max(0, round(L * k["centre_x"] - sw / 2)), L - sw)
    page.paste(Image.fromarray(np.where(garde, 255, 0).astype(np.uint8)), (x0, (H - sh) // 2))
    return page.convert("RGB")


def prompt_cn(cfg, c, v):
    return f"{v['scene']}, {c['passe_cn']['corps']}" + cfg["style"]


def generer_cn(cfg, out, seul, refs):
    import torch
    from diffusers import ControlNetModel, StableDiffusionXLControlNetPipeline, StableDiffusionXLPipeline
    choisies = [c for c in cfg["creatures"] if "passe_cn" in c and (not seul or c["id"] in seul)]
    cn = ControlNetModel.from_pretrained("diffusers/controlnet-canny-sdxl-1.0", torch_dtype=torch.float16,
                                         variant="fp16", use_safetensors=True)
    pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", controlnet=cn, torch_dtype=torch.float16,
        variant="fp16", use_safetensors=True).to("cuda")
    pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models",
                         weight_name="ip-adapter_sdxl.safetensors")
    # même UNet, même adaptateur, sans ControlNet : pour régénérer la variante de la 3e passe
    sans_cn = StableDiffusionXLPipeline(**{n: m for n, m in pipe.components.items() if n != "controlnet"})
    r = cfg["reglages"]

    def tirer(p, prompt, neg, c, v, echelle, ims, **cnet):
        pipe.set_ip_adapter_scale(echelle)
        return p(prompt, negative_prompt=neg, guidance_scale=r["guidance_scale"],
                 num_inference_steps=r["num_inference_steps"], width=c["largeur"], height=c["hauteur"],
                 generator=torch.Generator("cuda").manual_seed(v["graine"]),
                 ip_adapter_image=[ims], **cnet).images[0]

    for c in choisies:
        p3, pc = c["passe3"], c["passe_cn"]
        k = pc["precedente"]
        v3 = p3["variantes"][k]
        ims3 = [charger_ref(c, p3["references"][j], refs) for j in v3["refs"]]
        tirer(sans_cn, prompt_ip3(cfg, c, v3), cfg["neg"] + ", " + p3["neg"], c, v3, v3["echelle"], ims3) \
            .save(out / nom_ip3(c, k, v3))
        print(nom_ip3(c, k, v3), flush=True)
        carte = carte_cn(c, refs)
        carte.save(out / f"{c['id']}-cn-carte.png")  # dérivée d'une image du film : hors dépôt, hors planche
        ims = [charger_ref(c, p3["references"][j], refs) for j in pc["ip_refs"]]
        for i, v in enumerate(pc["variantes"]):
            t = time.time()
            tirer(pipe, prompt_cn(cfg, c, v), cfg["neg"] + ", " + pc["neg"], c, v, pc["echelle_ip"], ims,
                  image=carte, controlnet_conditioning_scale=v["poids"]).save(out / nom_cn(c, i, v))
            print(nom_cn(c, i, v), round(time.time() - t, 1), "s", flush=True)


def oui_non(x):
    return {True: "oui", False: "non", None: "?"}.get(x, x)


def planche_cn(c, out, cellule=640):
    """Variante retenue de la 3e passe en petit à gauche, puis la grille 2×2 graine × poids du
    ControlNet, chaque variante jugée : tête séparée des ailes, crête bleue, ressemblance au film,
    trop proche de la référence."""
    from PIL import Image, ImageDraw, ImageFont
    f = ImageFont.truetype(POLICE, 18)
    fs = ImageFont.truetype(POLICE, 15)
    fg = ImageFont.truetype(POLICE_GRAS, 19)
    ft = ImageFont.truetype(POLICE_GRAS, 30)
    p3, pc = c["passe3"], c["passe_cn"]
    vignettes = []
    for i, v in enumerate(pc["variantes"]):
        im = Image.open(out / nom_cn(c, i, v)).convert("RGB")
        im.thumbnail((cellule, cellule))
        vignettes.append((im, v))
    w = max(im.width for im, _ in vignettes)
    h = max(im.height for im, _ in vignettes)
    leg, marge, titre = 230, 16, 60
    k = pc["precedente"]
    v3 = p3["variantes"][k]
    prec = Image.open(out / nom_ip3(c, k, v3)).convert("RGB")
    prec.thumbnail((300, 300))
    gauche = prec.width + 2 * marge + 8
    page = Image.new("RGB", (gauche + 2 * w + 3 * marge, titre + 2 * (h + leg) + 2 * marge), "#10161c")
    d = ImageDraw.Draw(page)
    d.text((marge, 14), f"L63 — essai ControlNet canny + IP-Adapter : {c['id']}  ({c['fiche']})",
           font=ft, fill="#e8f4f8")
    y = ecrire(d, (marge, titre), "Avant : 3e passe, IP-Adapter seul", fg, 26, 2, "#e8f4f8")
    page.paste(prec, (marge, y + 4))
    y = ecrire(d, (marge, y + prec.height + 10), f"{c['id']}-ip3-{k + 1} · g{v3['graine']} · éch. "
               f"{v3['echelle']}", fs, 34, 1)
    ecrire(d, (marge, y + 4), "« la tête fusionne avec les ailes, on voit rien » (Sylvain)", fs, 30, 3, "#ffb86b")
    d.line([(gauche - 8, titre), (gauche - 8, page.height - marge)], fill="#3a4a55", width=2)
    for n, (im, v) in enumerate(vignettes):
        x = gauche + marge + (n % 2) * (w + marge)
        y = titre + (n // 2) * (h + leg + marge)
        page.paste(im, (x, y))
        col = max(30, w // 12)
        tete = (f"#{n + 1}  graine {v['graine']} · ControlNet {v['poids']} · IP-Adapter "
                f"{pc['echelle_ip']} — {v['scene_courte']}")
        yy = ecrire(d, (x, y + h + 6), tete, fg, col, 2, "#e8f4f8")
        verdict = (f"tête séparée des ailes : {oui_non(v['tete_separee'])} · crête bleue : "
                   f"{oui_non(v['crete_bleue'])} · ressemble au film : {v['ressemble_film'] or '?'} · "
                   f"trop proche de la référence : {oui_non(v['trop_proche'])}")
        yy = ecrire(d, (x, yy + 2), verdict, f, col + 4, 4, "#cfe3ea")
        ecrire(d, (x, yy + 2), v["jugement"] or "?", fs, col + 12, 3, "#9fb8c2")
    chemin = out / f"planche-cn-{c['id']}.png"
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
    if "--controlnet" in args:
        if "--planches" not in args:
            generer_cn(cfg, out, seul, refs)
        for c in cfg["creatures"]:
            if "passe_cn" in c and (not seul or c["id"] in seul):
                print(planche_cn(c, out))
        return
    if "--ip3" in args:
        if "--planches" not in args:
            generer_ip3(cfg, out, seul, refs)
        for c in cfg["creatures"]:
            if "passe3" in c and (not seul or c["id"] in seul):
                print(planche_ip3(c, out))
        return
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
