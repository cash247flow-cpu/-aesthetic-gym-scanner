# Step 1 of 2 for lib/bodyArt.ts. Download react-native-body-highlighter@3.2.0 (npm pack, MIT) into an empty folder,
# then: python3 -I scripts/body-art/extract.py <folder>/package/dist body-art.json
# Text-only extraction (nothing from the package is executed): slugs, path strings, outlines, viewBoxes.
import json, re, sys

d, outp = sys.argv[1], sys.argv[2]


def parts(f):
    src = open(f"{d}/assets/{f}.js").read()
    out = []
    for block in re.split(r'\n\s*\{\s*\n\s*slug:', src)[1:]:
        slug = re.match(r'\s*"([a-z-]+)"', block).group(1)
        paths = re.findall(r'"([Mm][ 0-9.\-][^"]+)"', block)
        out.append({"slug": slug, "paths": paths})
    return out


def wrapper(w, side):
    src = open(f"{d}/components/{w}.js").read()
    vb = re.search(r'const viewBox = side === "front" \? "([^"]+)" : "([^"]+)"', src)
    ol = re.search(r'side === "%s" && \(<react_native_svg_1\.Path[^>]*? d="([^"]+)"' % side, src)
    return (vb.group(1) if side == "front" else vb.group(2)), (ol.group(1) if ol else None)


out = {}
for sex, w, f, b in [("male", "SvgMaleWrapper", "bodyFront", "bodyBack"), ("female", "SvgFemaleWrapper", "bodyFemaleFront", "bodyFemaleBack")]:
    out[sex] = {}
    for side, file in (("front", f), ("back", b)):
        vb, ol = wrapper(w, side)
        out[sex][side] = {"viewBox": vb, "outline": ol, "parts": parts(file)}
        print(sex, side, vb, "outline:", bool(ol), " ".join(f'{p["slug"]}({len(p["paths"])})' for p in out[sex][side]["parts"]))
json.dump(out, open(outp, "w"))
