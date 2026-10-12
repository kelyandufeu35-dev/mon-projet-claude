"""Rendu photo-réaliste de la balle à friandises (Blender / Cycles).

Usage : python ball.py <scene> <sortie.png> [samples] [taille]
scene = main (fond clair), kibbles (fond jaune + croquettes), size (fond blanc)
"""
import math
import random
import sys

import bpy  # noqa: I001 (bpy doit être importé avant bmesh)
import bmesh
from mathutils import Vector

SCENE = sys.argv[1] if len(sys.argv) > 1 else "main"
OUT = sys.argv[2] if len(sys.argv) > 2 else f"/tmp/{SCENE}.png"
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 96
RES = int(sys.argv[4]) if len(sys.argv) > 4 else 1600

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


BACKDROP = {"main": "#f4ece2", "kibbles": "#f7b733", "size": "#f6f4f1", "spin": "#f4ece2"}[SCENE]

# ------------------------------------------------------------ Balle
def faceted_ball(rings=9, per_ring=16, raise_=1.034):
    """Diamants en relief : chaque losange est une petite pyramide."""
    bm = bmesh.new()
    ring, offs = [], []
    for k in range(rings):
        lat = -math.pi / 2 + (k + 1) * math.pi / (rings + 1)
        off = (k % 2) * 0.5
        offs.append(off)
        ring.append(
            [
                Vector((math.cos(lat) * math.cos(a), math.cos(lat) * math.sin(a), math.sin(lat)))
                for a in ((i + off) / per_ring * 2 * math.pi for i in range(per_ring))
            ]
        )
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
        j = round(i + offs[k] + 0.5 - offs[n]) % per_ring
        return ring[n][j]

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
    ob = bpy.data.objects.new("ball", me)
    scene.collection.objects.link(ob)
    # Arêtes adoucies comme un caoutchouc moulé.
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width = 0.014
    bev.segments = 3
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(5)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = 1
    for p in me.polygons:
        p.use_smooth = True
    return ob


ball = faceted_ball()
ball.location = (0, 0, 1)
ball.rotation_euler = (math.radians(4), math.radians(-3), math.radians(20))

rubber = bpy.data.materials.new("rubber")
rubber.use_nodes = True
nt = rubber.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = srgb("#c4140f")
bsdf.inputs["Roughness"].default_value = 0.5
bsdf.inputs["Subsurface Weight"].default_value = 0.03
bsdf.inputs["Subsurface Radius"].default_value = (0.6, 0.08, 0.05)
bsdf.inputs["Subsurface Scale"].default_value = 0.08
bsdf.inputs["Coat Weight"].default_value = 0.12
bsdf.inputs["Coat Roughness"].default_value = 0.25
# Grain très fin de la surface.
noise = nt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 260
noise.inputs["Detail"].default_value = 6
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.06
bump.inputs["Distance"].default_value = 0.002
nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
ball.data.materials.append(rubber)

# -------------------------------------------------------- Croquettes
def kibble_material():
    m = bpy.data.materials.new("kibble")
    m.use_nodes = True
    n = m.node_tree
    b = n.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.8
    tex = n.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 40
    tex.inputs["Detail"].default_value = 8
    ramp = n.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = srgb("#5a3014")
    ramp.color_ramp.elements[1].color = srgb("#9a5a26")
    n.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    n.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    bp = n.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.5
    bp.inputs["Distance"].default_value = 0.01
    n.links.new(tex.outputs["Fac"], bp.inputs["Height"])
    n.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


if SCENE == "kibbles":
    km = kibble_material()
    rnd = random.Random(7)
    spots = [(-1.25, -0.55), (-1.05, -1.05), (-1.55, -1.25), (-0.55, -1.5), (1.2, -0.7),
             (1.5, -0.2), (0.85, -1.3), (1.3, -1.45), (0.1, -1.75)]
    for x, y in spots:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1, depth=1)
        k = bpy.context.object
        r = 0.13 + rnd.random() * 0.03
        k.scale = (r * (0.9 + rnd.random() * 0.25), r, 0.085 + rnd.random() * 0.025)
        k.location = (x + rnd.uniform(-0.1, 0.1), y, k.scale.z * 0.45)
        k.rotation_euler = (rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), rnd.uniform(0, math.pi))
        bv = k.modifiers.new("b", "BEVEL")
        bv.width = 0.35
        bv.segments = 4
        sd = k.modifiers.new("s", "SUBSURF")
        sd.levels = sd.render_levels = 2
        disp_tex = bpy.data.textures.new("kd", "CLOUDS")
        disp_tex.noise_scale = 0.6
        dm = k.modifiers.new("d", "DISPLACE")
        dm.texture = disp_tex
        dm.strength = 0.08
        bpy.ops.object.shade_smooth()
        k.data.materials.append(km)

# ------------------------------------------------- Fond studio courbé
bpy.ops.mesh.primitive_plane_add(size=1)
bd = bpy.context.object
me = bd.data
bm = bmesh.new()
# Sol + mur reliés par un quart de cercle (cyclo), mur derrière la balle.
R = 5.0
pts = [(-30 + i * (32 / 20), 0.0) for i in range(21)]  # sol, de y=-30 à y=2
pts += [(2 + R * math.cos(a), R + R * math.sin(a)) for a in (-math.pi / 2 + (i / 24) * (math.pi / 2) for i in range(1, 25))]
pts += [(2 + R, R + 3 * i) for i in range(1, 6)]  # mur
cols = [(bm.verts.new((-30, y, z)), bm.verts.new((30, y, z))) for y, z in pts]
for a_, b_ in zip(cols, cols[1:]):
    bm.faces.new((a_[0], a_[1], b_[1], b_[0]))
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = True
bmat = bpy.data.materials.new("backdrop")
bmat.use_nodes = True
bb = bmat.node_tree.nodes["Principled BSDF"]
bb.inputs["Base Color"].default_value = srgb(BACKDROP)
bb.inputs["Roughness"].default_value = 0.9
me.materials.append(bmat)

# ----------------------------------------------------------- Lumière
def area(name, loc, size, energy, color="#ffffff", target=(0, 0, 0.9)):
    l = bpy.data.lights.new(name, "AREA")
    l.shape = "DISK"
    l.size = size
    l.energy = energy
    l.color = srgb(color)[:3]
    o = bpy.data.objects.new(name, l)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)


area("key", (-4.5, -4.0, 6.0), 3.0, 750, "#fff3e6")
area("fill", (5.5, -3.5, 2.5), 6.0, 70, "#f2f5ff")
area("rim", (2.5, 4.5, 4.5), 3.0, 450, "#ffe2d4")
area("top", (0, 0, 8), 4.0, 120)
area("wall", (0, -2.0, 9.0), 10.0, 900, "#ffffff", target=(0, 7, 3))
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("#ffffff")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.08
scene.world = world

# ------------------------------------------------------------ Caméra
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 85
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
if SCENE == "kibbles":
    cam.location = (0, -10.5, 3.4)
    target = Vector((0, -0.5, 0.75))
    cam_data.lens = 85
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = ball
    cam_data.dof.aperture_fstop = 2.8
elif SCENE == "size":
    cam.location = (0, -12.5, 2.0)
    target = Vector((0, 0, 0.75))
    cam_data.lens = 100
else:
    cam.location = (0, -10.5, 2.6)
    target = Vector((0, 0, 0.92))
    cam_data.lens = 100
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

# ------------------------------------------------------------- Rendu
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = RES
scene.render.film_transparent = False
scene.view_settings.view_transform = "Khronos PBR Neutral"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
if SCENE == "spin":
    # La balle roule sur elle-même (fond transparent, ombre seule au sol).
    bd.hide_render = True
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    floor = bpy.context.object
    floor.is_shadow_catcher = True
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    frames = 90
    scene.frame_start, scene.frame_end = 1, frames
    ball.rotation_mode = "XYZ"
    rx = ball.rotation_euler.x
    ball.keyframe_insert("rotation_euler", index=0, frame=1)
    ball.rotation_euler.x = rx - 2 * math.pi
    ball.keyframe_insert("rotation_euler", index=0, frame=frames + 1)
    act = ball.animation_data.action
    curves = act.fcurves if hasattr(act, "fcurves") else [c for l in act.layers for st in l.strips for c in st.channelbag(act.slots[0]).fcurves]
    for fc in curves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    scene.render.filepath = OUT.rstrip("/") + "/f_"
    bpy.ops.render.render(animation=True)
else:
    bpy.ops.render.render(write_still=True)

# Position à l'écran des bords gauche/droit de la balle (pour la cote 8 cm).
from bpy_extras.object_utils import world_to_camera_view

bpy.context.view_layer.update()
xs = []
for x in (-1.02, 1.02):
    co = world_to_camera_view(scene, cam, Vector((x, 0, 1)))
    xs.append(co.x * RES)
ys = world_to_camera_view(scene, cam, Vector((0, 0, 0))).y
print("BALL_PX", xs[0], xs[1], "GROUND_Y", (1 - ys) * RES)
