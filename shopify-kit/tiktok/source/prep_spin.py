"""Copie les images de la balle qui roule en adoucissant l'ombre (fond transparent).
Les images manquantes sont remplacées en bouclant sur celles déjà rendues."""
import os, sys
from PIL import Image
src, dst, n = sys.argv[1], sys.argv[2], 90
os.makedirs(dst, exist_ok=True)
have = sorted(f for f in os.listdir(src) if f.endswith('.png'))
for i in range(n):
    f = have[i % len(have)]
    im = Image.open(os.path.join(src, f)).convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r < 70 and g < 70 and b < 70:  # pixels d'ombre (noirs semi-transparents)
                # Ombre adoucie et fondue autour du point de contact de la balle.
                d = (((x - w * 0.52) / (w * 0.42)) ** 2 + ((y - h * 0.74) / (h * 0.14)) ** 2) ** 0.5
                fade = max(0.0, 1.0 - d) ** 1.5
                px[x, y] = (r, g, b, int(a * 0.6 * fade))
    im.save(os.path.join(dst, f'f_{i + 1:04d}.png'))
print(len(have), 'images source')
