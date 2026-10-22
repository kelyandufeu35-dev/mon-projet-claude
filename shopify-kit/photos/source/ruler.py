"""Ajoute la cote « 8 cm » sous la balle. Usage : ruler.py in.png out.jpg x_gauche x_droite y_sol"""
import sys
from PIL import Image, ImageDraw, ImageFont

src, out, xl, xr, ground = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:6])
im = Image.open(src).convert("RGB")
d = ImageDraw.Draw(im)
ink = (20, 22, 43)
y = ground + 120
w = 7
d.line([(xl, y), (xr, y)], fill=ink, width=w)
for x in (xl, xr):
    d.line([(x, y - 28), (x, y + 28)], fill=ink, width=w)
font = ImageFont.truetype(sys.path[0] + "/bricolage-800.ttf", 92)
d.text(((xl + xr) / 2, y + 44), "8 cm", font=font, fill=ink, anchor="mt")
im.save(out, quality=92, optimize=True)
