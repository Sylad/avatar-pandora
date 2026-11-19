"""L17 — génère en local les illustrations du codex (SDXL base 1.0, licence CreativeML Open RAIL++-M).

Usage (machine avec GPU et un venv qui a torch + diffusers) :
    python generer.py <dossier-png> [--seul pandora/intro ...]

Chaque entrée de illustrations.json donne son sujet (prompt), ce qu'on écarte (neg) et la
graine retenue après avoir regardé les candidats : relancer redonne la même image (au bruit
numérique du GPU près). Les PNG sortent sous <dossier-png>/<section>-<fiche>.png ; preparer.py
les convertit ensuite en WebP pour le site. Aucune image tierce : le modèle part du texte seul.

Exception (L63, D-2) : une entrée qui porte « ip_adapter » est une œuvre de fan guidée par des
images officielles (avatar.com/pandorapedia) passées à IP-Adapter SDXL (h94/IP-Adapter) comme
références seulement. Son prompt et son négatif sont pris tels quels (sans STYLE ni NEG), à sa
taille (largeur × hauteur) et à son échelle IP-Adapter. Les références ne sont JAMAIS dans le
dépôt : seules leurs URL sont notées ; les fichiers se lisent dans
<refs>/<dossier_refs>/<nom de fichier de l'URL> (par défaut ~/projects/developpeur/tmp/l63-refs,
option --refs <dossier>), avec recadrage et masque éventuels comme dans essais.py.
"""
import json, os, sys, time
from pathlib import Path

ICI = Path(__file__).parent
STYLE = (", cinematic matte painting, highly detailed, rich bioluminescent cyan and teal palette"
         " with touches of violet, no people, no text")
NEG = ("text, letters, caption, watermark, signature, logo, frame, border, people, human, person, face,"
       " portrait, blurry, low quality, deformed, cartoon, european dragon, wyvern")


REFS = Path(os.path.expanduser("~/projects/developpeur/tmp/l63-refs"))


def references(e, refs):
    """Images de référence d'une entrée IP-Adapter, lues hors du dépôt."""
    from PIL import Image, ImageDraw
    ims = []
    for r in e["ip_adapter"]["references"]:
        f = refs / e["ip_adapter"]["dossier_refs"] / r["image"].rsplit("/", 1)[1]
        if not f.exists():
            sys.exit(f"référence absente : {f} (télécharger {r['image']})")
        im = Image.open(f).convert("RGB")
        if r.get("masque"):  # [x0, y0, x1, y1] peint en blanc, coordonnées de l'image d'origine
            ImageDraw.Draw(im).rectangle(r["masque"], fill="white")
        if r.get("recadrage"):
            im = im.crop(tuple(r["recadrage"]))
        ims.append(im)
    return ims


def main():
    args = sys.argv[1:]
    refs = REFS
    if "--refs" in args:
        k = args.index("--refs")
        refs = Path(args[k + 1]).expanduser()
        del args[k:k + 2]
    out = Path(args[0]); out.mkdir(parents=True, exist_ok=True)
    seul = set(args[args.index("--seul") + 1:]) if "--seul" in args else None
    import torch
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16,
        variant="fp16", use_safetensors=True).to("cuda")
    entrees = [e for e in json.loads((ICI / "illustrations.json").read_text())
               if not seul or e["fiche"] in seul]
    # Texte seul d'abord : une fois IP-Adapter chargé, chaque appel attend une image de référence.
    entrees.sort(key=lambda e: "ip_adapter" in e)
    charge = False
    for e in entrees:
        t = time.time()
        if "ip_adapter" in e:
            if not charge:
                pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models",
                                     weight_name="ip-adapter_sdxl.safetensors")
                charge = True
            pipe.set_ip_adapter_scale(e["ip_adapter"]["echelle"])
            # une liste d'images pour l'unique adaptateur : leurs jetons sont concaténés (cf. essais.py)
            ip = {"ip_adapter_image": [references(e, refs)]}
            prompt, neg = e["prompt"], e["neg"]
        else:
            ip = {}
            prompt, neg = e["prompt"] + STYLE, NEG + (", " + e["neg"] if e.get("neg") else "")
        img = pipe(prompt, negative_prompt=neg, guidance_scale=7.0, num_inference_steps=32,
                   width=e.get("largeur", 1344), height=e.get("hauteur", 768),
                   generator=torch.Generator("cuda").manual_seed(e["graine"]), **ip).images[0]
        img.save(out / (e["fiche"].replace("/", "-") + ".png"))
        print(e["fiche"], round(time.time() - t, 1), "s", flush=True)


if __name__ == "__main__":
    main()
