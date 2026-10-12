"""Animation 3D publicitaire de la balle (Blender / Cycles), format vertical.

Usage : python anim.py <plan> <dossier_sortie> [échantillons] [largeur] [image_début] [image_fin]
plans : drop, macro, roll, trio, hero
"""
import math
import random
import sys

import bpy  # noqa: I001 (bpy doit être importé avant bmesh)
import bmesh
from mathutils import Vector

SHOT = sys.argv[1]
OUT = sys.argv[2].rstrip("/")
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 12
RES_X = int(sys.argv[4]) if len(sys.argv) > 4 else 720
F0 = int(sys.argv[5]) if len(sys.argv) > 5 else None
F1 = int(sys.argv[6]) if len(sys.argv) > 6 else None
FPS = 24
FRAMES = {"drop": 36, "macro": 36, "roll": 60, "trio": 48, "hero": 60}[SHOT]
BG = {"drop": "#ffc23a", "macro": "#ff7aa8", "roll": "#4fd1a5", "trio": "#2338e8", "hero": "#ffc23a"}[SHOT]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, FRAMES


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# ------------------------------------------------------------ Balle
def ball_mesh(rings=9, per_ring=16, raise_=1.034):
    bm = bmesh.new()
    ring, offs = [], []
    for k in range(rings):
        lat = -math.pi / 2 + (k + 1) * math.pi / (rings + 1)
        off = (k % 2) * 0.5
        offs.append(off)
        ring.append([Vector((math.cos(lat) * math.cos(a), math.cos(lat) * math.sin(a), math.sin(lat)))
                     for a in ((i + off) / per_ring * 2 * math.pi for i in range(per_ring))])
    south, north = Vector((0, 0, -0.965)), Vector((0, 0, 0.965))
    cache = {}

    def vert(p):
        key = (round(p.x, 5), round(p.y, 5), round(p.z, 5))
        if key not in cache:
            cache[key] = bm.verts.new(p)
        return cache[key]

    def between(k, i, dk):
        n = k + dk
        if n < 0:
            return south
        if n >= rings:
            return north
        return ring[n][round(i + offs[k] + 0.5 - offs[n]) % per_ring]

    for k in range(rings):
        for i in range(per_ring):
            L, R = ring[k][i], ring[k][(i + 1) % per_ring]
            T, B = between(k, i, 1), between(k, i, -1)
            C = (L + R + T + B).normalized() * raise_
            for a, b in ((L, T), (T, R), (R, B), (B, L)):
                bm.faces.new((vert(C), vert(a), vert(b)))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("ball")
    bm.to_mesh(me)
    for p in me.polygons:
        p.use_smooth = True
    return me


RUBBER = bpy.data.materials.new("rubber")
RUBBER.use_nodes = True
_b = RUBBER.node_tree.nodes["Principled BSDF"]
_b.inputs["Base Color"].default_value = srgb("#c4140f")
_b.inputs["Roughness"].default_value = 0.5
_b.inputs["Coat Weight"].default_value = 0.12
_b.inputs["Coat Roughness"].default_value = 0.25
BALL_ME = ball_mesh()


def new_ball(name="ball"):
    ob = bpy.data.objects.new(name, BALL_ME)
    scene.collection.objects.link(ob)
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width, bev.segments, bev.limit_method, bev.angle_limit = 0.014, 2, "ANGLE", math.radians(5)
    ob.data.materials.append(RUBBER) if not ob.data.materials else None
    ob.rotation_mode = "XYZ"
    return ob


# -------------------------------------------------------- Croquettes
KIB = bpy.data.materials.new("kibble")
KIB.use_nodes = True
_k = KIB.node_tree.nodes["Principled BSDF"]
_k.inputs["Base Color"].default_value = srgb("#7a4219")
_k.inputs["Roughness"].default_value = 0.8


def new_kibble(rnd):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=1, depth=1)
    k = bpy.context.object
    r = 0.12 + rnd.random() * 0.03
    k.scale = (r * (0.9 + rnd.random() * 0.25), r, 0.09)
    bv = k.modifiers.new("b", "BEVEL")
    bv.width, bv.segments = 0.35, 3
    sd = k.modifiers.new("s", "SUBSURF")
    sd.levels = sd.render_levels = 1
    bpy.ops.object.shade_smooth()
    k.data.materials.append(KIB)
    return k


def key(ob, frame, loc=None, rot=None, scale=None):
    if loc is not None:
        ob.location = loc
        ob.keyframe_insert("location", frame=frame)
    if rot is not None:
        ob.rotation_euler = rot
        ob.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        ob.scale = scale
        ob.keyframe_insert("scale", frame=frame)


def bounce_z(t, t0, h0, g=40.0, rest=0.42, n=4):
    """Hauteur (au-dessus du sol) d'un objet lâché de h0 à t0, avec rebonds."""
    if t < t0:
        return h0
    tt = t - t0
    t_fall = math.sqrt(2 * h0 / g)
    if tt < t_fall:
        return h0 - 0.5 * g * tt * tt
    tt -= t_fall
    v = g * t_fall * rest
    for _ in range(n):
        dur = 2 * v / g
        if tt < dur:
            return v * tt - 0.5 * g * tt * tt
        tt -= dur
        v *= rest
    return 0.0


def ballistic(t, t0, p0, v0, g=30.0, floor=0.04):
    """Position d'une croquette éjectée (arc puis petits rebonds au sol)."""
    if t < t0:
        return None
    tt = t - t0
    x = p0[0] + v0[0] * tt
    y = p0[1] + v0[1] * tt
    z = p0[2] + v0[2] * tt - 0.5 * g * tt * tt
    if z < floor:
        # Après l'impact : glisse en ralentissant, reste au sol.
        disc = v0[2] ** 2 + 2 * g * (p0[2] - floor)
        t_hit = (v0[2] + math.sqrt(max(0, disc))) / g
        slide = min(tt - t_hit, 0.35)
        x = p0[0] + v0[0] * (t_hit + slide * (1 - slide / 0.7))
        y = p0[1] + v0[1] * (t_hit + slide * (1 - slide / 0.7))
        z = floor
    return (x, y, z)


# ------------------------------------------------- Décor et lumière
def backdrop(color):
    me = bpy.data.meshes.new("bd")
    bm = bmesh.new()
    R = 5.0
    pts = [(-30 + i * (32 / 20), 0.0) for i in range(21)]
    pts += [(2 + R * math.cos(a), R + R * math.sin(a)) for a in (-math.pi / 2 + (i / 24) * (math.pi / 2) for i in range(1, 25))]
    pts += [(2 + R, R + 4 * i) for i in range(1, 6)]
    cols = [(bm.verts.new((-30, y, z)), bm.verts.new((30, y, z))) for y, z in pts]
    for a_, b_ in zip(cols, cols[1:]):
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("backdrop", me)
    scene.collection.objects.link(ob)
    m = bpy.data.materials.new("bd")
    m.use_nodes = True
    n = m.node_tree.nodes["Principled BSDF"]
    n.inputs["Base Color"].default_value = srgb(color)
    n.inputs["Roughness"].default_value = 0.85
    me.materials.append(m)
    return ob


def area(name, loc, size, energy, color="#ffffff", target=(0, 0, 0.9)):
    l = bpy.data.lights.new(name, "AREA")
    l.shape, l.size, l.energy = "DISK", size, energy
    l.color = srgb(color)[:3]
    o = bpy.data.objects.new(name, l)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)


backdrop(BG)
area("key", (-4.5, -4.0, 6.0), 3.0, 750, "#fff3e6")
area("fill", (5.5, -3.5, 2.5), 6.0, 90, "#f2f5ff")
area("rim", (2.5, 4.5, 4.5), 3.0, 500, "#ffe2d4")
area("wall", (0, -2.0, 9.0), 10.0, 700, "#ffffff", target=(0, 7, 3))
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.08
scene.world = world

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
target = bpy.data.objects.new("target", None)
scene.collection.objects.link(target)
trk = cam.constraints.new("TRACK_TO")
trk.target, trk.track_axis, trk.up_axis = target, "TRACK_NEGATIVE_Z", "UP_Y"

rnd = random.Random(11)
t_of = lambda f: (f - 1) / FPS  # noqa: E731

# ------------------------------------------------------------- Plans
if SHOT == "drop":
    # La balle tombe, s'écrase au sol et éjecte des croquettes.
    ball = new_ball()
    cam_data.lens = 50
    for f in range(1, FRAMES + 1):
        t = t_of(f)
        z = bounce_z(t, 0.0, 4.2)
        # Écrasement au contact du sol.
        # Écrasement seulement au moment des impacts (pas une fois posée).
        squash = 1.0
        for ti, amount in ((0.458, 0.22), (0.843, 0.1)):
            d = abs(t - ti)
            if d < 0.06:
                squash = min(squash, 1 - amount * (1 - d / 0.06))
        key(ball, f, loc=(0, 0, 1 + z - (1 - squash)), rot=(0.1, 0.05, 0.35 + t * 1.5), scale=(1 / math.sqrt(squash), 1 / math.sqrt(squash), squash))
        key(cam, f, loc=(0, -8.0 + t * 1.4, 2.0 + t * 0.2))
        key(target, f, loc=(0, 0, 1.35))
    t_hit = math.sqrt(2 * 4.2 / 40.0)
    for i in range(12):
        k = new_kibble(rnd)
        a = i / 12 * 2 * math.pi + rnd.uniform(-0.2, 0.2)
        sp = rnd.uniform(1.0, 1.9)
        # Éjection surtout vers la caméra (y négatif), pour rester dans le cadre vertical.
        v0 = (math.cos(a) * sp, -abs(math.sin(a)) * sp * 1.6 - 0.6, rnd.uniform(5, 7.5))
        for f in range(1, FRAMES + 1):
            p = ballistic(t_of(f), t_hit, (math.cos(a) * 0.6, math.sin(a) * 0.4, 0.5), v0)
            key(k, f, loc=p if p else (0, 0, -3), rot=(t_of(f) * 9 + i, t_of(f) * 7, i), scale=None)

elif SHOT == "macro":
    # Gros plan : la caméra tourne autour des facettes.
    ball = new_ball()
    ball.location = (0, 0, 1)
    cam_data.lens = 85
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = ball
    cam_data.dof.aperture_fstop = 2.0
    for f in range(1, FRAMES + 1):
        t = t_of(f)
        a = -1.9 + t * 0.9
        key(cam, f, loc=(math.cos(a) * 6.6, math.sin(a) * 6.6, 1.9 + t * 0.3))
        key(ball, f, rot=(0.2, 0, t * 0.8))
        key(target, f, loc=(0, 0, 1.25))

elif SHOT == "roll":
    # La balle roule et sème des croquettes derrière elle.
    ball = new_ball()
    cam_data.lens = 50
    x0, x1 = -3.0, 3.0
    for f in range(1, FRAMES + 1):
        t = t_of(f)
        u = t / ((FRAMES - 1) / FPS)
        x = x0 + (x1 - x0) * (1 - (1 - u) ** 1.6)
        key(ball, f, loc=(x, 0, 1), rot=(0.1, (x - x0) / 1.0, 0.2))
        key(cam, f, loc=(x * 0.8, -8.0, 2.4))
        key(target, f, loc=(x * 0.85 - 0.25, 0, 0.85))
    drops = [0.2 + 0.18 * i for i in range(11)]
    for i, td in enumerate(drops):
        k = new_kibble(rnd)
        u = td / ((FRAMES - 1) / FPS)
        xd = x0 + (x1 - x0) * (1 - (1 - u) ** 1.6) - 0.75
        v0 = (rnd.uniform(-0.5, 0.1), rnd.uniform(-1.4, -0.4), rnd.uniform(2.0, 3.2))
        for f in range(1, FRAMES + 1):
            p = ballistic(t_of(f), td, (xd, 0, 0.55), v0)
            key(k, f, loc=p if p else (0, 0, -3), rot=(t_of(f) * 8 + i, i, t_of(f) * 5))

elif SHOT == "trio":
    # Trois balles tombent l'une après l'autre (offre par 3).
    cam_data.lens = 38
    xs = [(-1.15, -0.4), (1.15, -0.4), (0, 1.3)]
    balls = [new_ball(f"b{i}") for i in range(3)]
    for f in range(1, FRAMES + 1):
        t = t_of(f)
        for i, b in enumerate(balls):
            z = bounce_z(t, 0.12 + i * 0.32, 5.0)
            key(b, f, loc=(xs[i][0], xs[i][1], 1 + z), rot=(0.1 * i, 0.2, 0.4 * i + t))
        key(cam, f, loc=(0, -12.0 + t * 0.6, 3.4))
        key(target, f, loc=(0, 0.3, 1.2))

elif SHOT == "hero":
    # Plan final : la balle tourne doucement, place pour le prix.
    ball = new_ball()
    ball.location = (0, 0, 1)
    cam_data.lens = 60
    for f in range(1, FRAMES + 1):
        t = t_of(f)
        a = -math.pi / 2 - 0.35 + t * 0.28
        key(cam, f, loc=(math.cos(a) * 9.5, math.sin(a) * 9.5, 2.0))
        key(ball, f, rot=(0.15, 0, 0.3 + t * 1.2))
        key(target, f, loc=(0, 0, 1.0))
    rk = random.Random(5)
    for i, (x, y) in enumerate([(-1.5, -0.6), (-1.2, -1.2), (1.4, -0.8), (1.0, -1.4), (0.2, -1.6)]):
        k = new_kibble(rk)
        k.location = (x, y, 0.045)
        k.rotation_euler = (0, 0, rk.uniform(0, 3))

# Interpolation linéaire (les courbes sont déjà échantillonnées image par image).
for ob in scene.objects:
    ad = ob.animation_data
    if ad and ad.action:
        act = ad.action
        curves = act.fcurves if hasattr(act, "fcurves") else [c for l in act.layers for st in l.strips for c in st.channelbag(act.slots[0]).fcurves]
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"

# ------------------------------------------------------------- Rendu
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 4
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.5
scene.render.resolution_x = RES_X
scene.render.resolution_y = int(RES_X * 16 / 9)
scene.view_settings.view_transform = "Khronos PBR Neutral"
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 94
if F0:
    scene.frame_start = F0
if F1:
    scene.frame_end = F1
scene.render.filepath = f"{OUT}/f_"
bpy.ops.render.render(animation=True)
