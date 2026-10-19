"""Vidéo Google Ads Pattoune : 18 s, photos produits réelles, sans IA ni voix.

python3 video.py <format> [--still t]   format : vertical | carre | paysage
Plans calés sur la musique (120 BPM) : 0-2,5 intro · 2,5-14,5 quatre rayons de 3 s
(deux photos chacun) · 14,5-18 fin.
"""
import subprocess, sys, math
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

G = '/tmp/claude-0/-home-user-mon-projet-claude/b0a50f99-8e8e-5116-8461-0675cba5bd6e/scratchpad'
R = '/home/user/mon-projet-claude/shopify-kit/'
P, U = R + 'photos-produits/', G + '/gads/up/'
FONTS = G + '/night/fonts/'
FPS, DUR = 30, 18.0
INK, SUN, PAPER, WHITE, POP = (20, 22, 43), (255, 194, 58), (244, 236, 226), (255, 255, 255), (255, 122, 168)
SIZES = {'vertical': (1080, 1920), 'carre': (1080, 1080), 'paysage': (1920, 1080)}

# (début, fin, rubrique, titre, [(photo, focus x, focus y), ...])
SCENES = [
    (2.5, 5.5, 'Jouets', 'De quoi l’occuper', [(U + 'pattoune-02-chat-canne-a-plumes.png', .55, .42), (U + 'pattoune-03-chien-balles-a-garnir.png', .5, .5)]),
    (5.5, 8.5, 'Couchage', 'Des paniers tout doux', [(P + 'panier-rond/02-deux-chats.jpg', .5, .5), (P + 'panier-igloo/02-rose-chat.jpg', .45, .55)]),
    (8.5, 11.5, 'Promenade', 'Pour les balades', [(P + 'laisse/01-balade.jpg', .62, .6), (P + 'harnais/01-couverture.jpg', .5, .42)]),
    (11.5, 14.5, 'Repas et propreté', 'Pour son quotidien', [(P + 'distributeur/01-couverture.jpg', .5, .55), (P + 'tapis-litiere/01-gris.jpg', .5, .55)]),
]
END = 14.5


def font(kind, size, weight=None):
    if kind == 'display':
        f = ImageFont.truetype(FONTS + 'bricolage-latin.woff2', size); f.set_variation_by_axes([weight or 800, 100])
    else:
        f = ImageFont.truetype(FONTS + 'figtree-latin.woff2', size); f.set_variation_by_axes([weight or 600])
    return f


def ease(x):
    x = min(max(x, 0), 1); return 1 - (1 - x) ** 3


class Video:
    def __init__(self, fmt):
        self.fmt = fmt; self.W, self.H = SIZES[fmt]; self.u = min(self.W, self.H) / 1080
        badge = Image.open(R + 'pinterest/pattoune-photo-profil.png').convert('RGB')
        self.icon = badge.crop((180, 300, 900, 980))  # patte + balle, fond jaune
        self.cache = {}

    def photo(self, path, fx, fy, zoom):
        """Photo plein cadre recadrée autour de (fx, fy), zoom lent (effet Ken Burns)."""
        if path not in self.cache:
            im = Image.open(path).convert('RGB')
            k = max(self.W / im.width, self.H / im.height) * 1.12
            self.cache[path] = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im = self.cache[path]; w, h = im.size
        # fenêtre W×H dans l'image pré-agrandie (marge de 12 % pour cadrer), réduite par le zoom
        cw, ch = self.W / zoom, self.H / zoom
        x = min(max(fx * w - cw / 2, 0), w - cw); y = min(max(fy * h - ch / 2, 0), h - ch)
        return im.resize((self.W, self.H), Image.BILINEAR, box=(x, y, x + cw, y + ch))

    def pill(self, d, xy, text, f, bg, fg, padx, pady, anchor='l'):
        l, t, r, b = d.textbbox((0, 0), text, font=f, anchor='ls')
        w, h = r - l + 2 * padx, b - t + 2 * pady
        x, y = xy
        if anchor == 'm': x -= w / 2
        d.rounded_rectangle((x, y, x + w, y + h), radius=h / 2, fill=bg)
        d.text((x + padx - l, y + pady - t), text, font=f, fill=fg, anchor='ls')
        return w, h

    def logo(self, c, x, y, h):
        ic = self.icon.resize((h, h), Image.LANCZOS)
        m = Image.new('L', ic.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, h - 1, h - 1), h // 4, fill=255)
        c.paste(ic, (x, y), m)
        d = ImageDraw.Draw(c); f = font('display', round(h * .62))
        d.text((x + h + round(h * .25), y + h / 2), 'Pattoune', font=f, fill=INK, anchor='lm')

    def corner_logo(self, c):
        u = self.u; h = round(78 * u); pad = round(28 * u)
        f = font('display', round(h * .62)); tw = ImageDraw.Draw(c).textlength('Pattoune', font=f)
        box = Image.new('RGB', (round(h + h * .25 + tw + pad * 1.4 + 18 * u), h + round(20 * u)), WHITE)
        m = Image.new('L', box.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, box.width - 1, box.height - 1), box.height // 2, fill=235)
        c.paste(box, (pad, pad), m)
        self.logo(c, pad + round(10 * u), pad + round(10 * u), h)

    def caption(self, c, eyebrow, title, p):
        """Bloc de texte qui monte et apparaît (p = 0 → 1)."""
        u = self.u; a = ease(p); d = ImageDraw.Draw(c)
        fe, ft = font('body', round(40 * u), 700), font('display', round(92 * u))
        lines = [title]
        maxw = (self.W * .86) if self.fmt != 'paysage' else self.W * .5
        if d.textlength(title, font=ft) > maxw:
            # coupe en deux lignes les plus équilibrées possible
            words = title.split()
            splits = [(' '.join(words[:k]), ' '.join(words[k:])) for k in range(1, len(words))]
            lines = list(min(splits, key=lambda s: max(d.textlength(l, font=ft) for l in s)))
        lh = round(100 * u); pad = round(44 * u)
        bw = max(d.textlength(l, font=ft) for l in lines) + 2 * pad
        bh = round(60 * u) + round(26 * u) + lh * len(lines) + 2 * pad - round(14 * u)
        if self.fmt == 'vertical': x, y = (self.W - bw) / 2, self.H * .66
        elif self.fmt == 'carre': x, y = (self.W - bw) / 2, self.H - bh - round(60 * u)
        else: x, y = round(80 * u), self.H - bh - round(80 * u)
        y += (1 - a) * 60 * u
        layer = Image.new('RGBA', c.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
        ld.rounded_rectangle((x, y, x + bw, y + bh), radius=round(40 * u), fill=PAPER + (round(245 * a),))
        cx = x + bw / 2 if self.fmt != 'paysage' else x + pad
        anchor = 'm' if self.fmt != 'paysage' else 'l'
        ey = y + pad
        lw, lh2 = self.pill(ld, (cx, ey), eyebrow, fe, SUN + (round(255 * a),), INK + (round(255 * a),), round(26 * u), round(12 * u), anchor)
        ty = ey + lh2 + round(26 * u)
        for i, l in enumerate(lines):
            ld.text((cx, ty + i * lh + round(78 * u)), l, font=ft, fill=INK + (round(255 * a),), anchor=('ms' if anchor == 'm' else 'ls'))
        c.paste(layer, (0, 0), layer)

    def card(self, t, final):
        """Écran jaune : intro (logo + promesse) ou fin (livraison offerte)."""
        u = self.u; c = Image.new('RGB', (self.W, self.H), SUN); d = ImageDraw.Draw(c)
        # deux bulles décoratives
        lay = Image.new('RGBA', c.size, (0, 0, 0, 0)); ldd = ImageDraw.Draw(lay)
        r = round(420 * u); ldd.ellipse((self.W - r * 1.2, -r * .6, self.W + r * .8, r * 1.4), fill=WHITE + (60,))
        ldd.ellipse((-r * .8, self.H - r * 1.2, r * 1.2, self.H + r * .8), fill=POP + (70,))
        c.paste(lay, (0, 0), lay)
        a = ease(t / .6); b = ease((t - .35) / .6); e = ease((t - .7) / .6)
        h = round((150 if self.fmt != 'paysage' else 130) * u * (0.85 + .15 * a))
        f = font('display', round(h * .62)); tw = d.textlength('Pattoune', font=f)
        lw = h + h * .25 + tw
        cy = self.H * (.36 if self.fmt == 'vertical' else .3)
        self.logo(c, round((self.W - lw) / 2), round(cy - h / 2), h)
        lay = Image.new('RGBA', c.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
        if not final:
            l1, l2 = 'Tout pour ton chat', 'et ton chien'
            ft = font('display', round(104 * u))
            y0 = cy + h / 2 + round(150 * u)
            for i, l in enumerate((l1, l2)):
                ld.text((self.W / 2, y0 + i * round(116 * u) + (1 - b) * 40 * u), l, font=ft, fill=INK + (round(255 * b),), anchor='ms')
            fs = font('body', round(42 * u), 600)
            ld.text((self.W / 2, y0 + round(116 * u) + round(100 * u) + (1 - e) * 30 * u), 'Jouets · Paniers · Promenade · Repas · Soin', font=fs, fill=INK + (round(220 * e),), anchor='ms')
        else:
            ft = font('display', round(96 * u)); fs = font('body', round(44 * u), 600)
            y0 = cy + h / 2 + round(150 * u)
            for i, l in enumerate(('Livraison offerte', 'dès 25 €')):
                ld.text((self.W / 2, y0 + i * round(108 * u) + (1 - b) * 40 * u), l, font=ft, fill=INK + (round(255 * b),), anchor='ms')
            ld.text((self.W / 2, y0 + round(108 * u) + round(92 * u)), 'France, UE et Suisse · colis suivi', font=fs, fill=INK + (round(230 * e),), anchor='ms')
            fb = font('body', round(46 * u), 800)
            self.pill(ld, (self.W / 2, y0 + round(108 * u) + round(150 * u) + (1 - e) * 30 * u), 'Découvre la boutique', fb, INK + (round(255 * e),), WHITE + (round(255 * e),), round(46 * u), round(24 * u), 'm')
        c.paste(lay, (0, 0), lay)
        return c

    def frame(self, t):
        if t < SCENES[0][0]:
            return self.card(t, False)
        if t >= END:
            return self.card(t - END, True)
        for t0, t1, eb, title, photos in SCENES:
            if t0 <= t < t1:
                half = (t1 - t0) / 2; i = 0 if t < t0 + half else 1
                path, fx, fy = photos[i]
                local = (t - t0 - i * half) / half
                c = self.photo(path, fx, fy, 1.0 + .07 * local)
                self.corner_logo(c)
                self.caption(c, eb, title, (t - t0) / .45)
                return c

    def blend(self, t):
        """Fondu rapide (0,2 s) à chaque changement de plan."""
        cuts = [SCENES[0][0]] + [s[0] + (s[1] - s[0]) / 2 for s in SCENES] + [s[1] for s in SCENES]
        im = self.frame(t)
        for k in cuts:
            if k - .2 <= t < k:
                return Image.blend(im, self.frame(k), (t - (k - .2)) / .2)
        return im


if __name__ == '__main__':
    fmt = sys.argv[1]; v = Video(fmt)
    if '--still' in sys.argv:
        for s in sys.argv[sys.argv.index('--still') + 1:]:
            v.blend(float(s)).save(f'{G}/gvid/still-{fmt}-{s}.jpg', quality=85)
        sys.exit()
    out = f'{G}/gvid/pattoune-google-ads-{fmt}.mp4'
    W, H = SIZES[fmt]
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-i', f'{G}/gvid/music.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
                           '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    for n in range(int(DUR * FPS)):
        ff.stdin.write(v.blend(n / FPS).tobytes())
    ff.stdin.close(); ff.wait(); print('ok', out)
