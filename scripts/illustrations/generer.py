"""L17 — génère en local les illustrations du codex (SDXL base 1.0, licence CreativeML Open RAIL++-M).

Usage (machine avec GPU et un venv qui a torch + diffusers) :
    python generer.py <dossier-png> [--seul pandora/intro ...]

Chaque entrée de illustrations.json donne son sujet (prompt), ce qu'on écarte (neg) et la
graine retenue après avoir regardé les candidats : relancer redonne la même image (au bruit
numérique du GPU près). Les PNG sortent sous <dossier-png>/<section>-<fiche>.png ; preparer.py
les convertit ensuite en WebP pour le site. Aucune image tierce : le modèle part du texte seul.
"""
import json, sys, time
from pathlib import Path

ICI = Path(__file__).parent
STYLE = (", cinematic matte painting, highly detailed, rich bioluminescent cyan and teal palette"
         " with touches of violet, no people, no text")
NEG = ("text, letters, caption, watermark, signature, logo, frame, border, people, human, person, face,"
       " portrait, blurry, low quality, deformed, cartoon, european dragon, wyvern")


def main():
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    seul = set(sys.argv[sys.argv.index("--seul") + 1:]) if "--seul" in sys.argv else None
    import torch
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16,
        variant="fp16", use_safetensors=True).to("cuda")
    for e in json.loads((ICI / "illustrations.json").read_text()):
        if seul and e["fiche"] not in seul:
            continue
        t = time.time()
        img = pipe(e["prompt"] + STYLE, negative_prompt=NEG + (", " + e["neg"] if e.get("neg") else ""),
                   guidance_scale=7.0, num_inference_steps=32, width=1344, height=768,
                   generator=torch.Generator("cuda").manual_seed(e["graine"])).images[0]
        img.save(out / (e["fiche"].replace("/", "-") + ".png"))
        print(e["fiche"], round(time.time() - t, 1), "s", flush=True)


if __name__ == "__main__":
    main()
