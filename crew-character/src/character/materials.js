/* Palette + matériaux doux (tissu avec « sheen », peau légèrement satinée, plastiques mats). */
import * as THREE from "three";

/* Mode « léger » (window.__GFX.lite) : MeshStandardMaterial à la place de MeshPhysicalMaterial (sheen / clearcoat) – rendu logiciel plus rapide. */
const LITE = typeof window !== "undefined" && !!(window.__GFX && window.__GFX.lite);
export const Phys = LITE ? class extends THREE.MeshStandardMaterial { constructor(o = {}) { const { sheen, sheenColor, sheenRoughness, clearcoat, clearcoatRoughness, ...rest } = o; super(rest); } } : THREE.MeshPhysicalMaterial;

export const COLORS = {
  red: "#DA291C", redDeep: "#B01E14", redLight: "#F2483A", yellow: "#FFC72C", yellowDeep: "#E7A400",
  cream: "#FFF4DC", white: "#F8F6F1", skin: "#EDB48C", skinShade: "#D78F66", hair: "#2B1E16",
  pants: "#2B3040", shoeSole: "#F3F0E9", steel: "#D5DCE3", ink: "#1D1A17",
};

export function createMaterials() {
  const fabric = (color, o = {}) => new Phys({ color, roughness: 0.82, metalness: 0, sheen: 0.9, sheenColor: new THREE.Color(o.sheen || "#ffd2c8"), sheenRoughness: 0.5, ...o.extra });
  const plastic = (color, o = {}) => new Phys({ color, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35, ...o });
  const matte = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
  return {
    skin: new Phys({ color: COLORS.skin, roughness: 0.56, sheen: 0.6, sheenColor: new THREE.Color("#ffab94"), sheenRoughness: 0.45, clearcoat: 0.06, clearcoatRoughness: 0.5, emissive: new THREE.Color("#ff9a78"), emissiveIntensity: 0.045 }),
    skinDark: matte(COLORS.skinShade, { roughness: 0.65 }),
    hair: new Phys({ color: COLORS.hair, roughness: 0.42, sheen: 0.4, sheenColor: new THREE.Color("#8a6a55"), clearcoat: 0.2, clearcoatRoughness: 0.4 }),
    red: fabric(COLORS.red, { sheen: "#ff8a7a" }),
    redShiny: plastic(COLORS.red),
    redDeep: fabric(COLORS.redDeep, { sheen: "#ff6a5a" }),
    yellow: fabric(COLORS.yellow, { sheen: "#fff2b0" }),
    yellowShiny: plastic(COLORS.yellow, { roughness: 0.38 }),
    pants: fabric(COLORS.pants, { sheen: "#6a7390" }),
    white: matte(COLORS.white, { roughness: 0.55 }),
    sole: matte(COLORS.shoeSole, { roughness: 0.6 }),
    shoe: new Phys({ color: "#FBF9F4", roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    ink: matte(COLORS.ink, { roughness: 0.4 }),
    sclera: new Phys({ color: "#FFFFFF", roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
    iris: new Phys({ color: "#6A4025", roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
    pupil: new THREE.MeshBasicMaterial({ color: "#0b0706" }),
    glint: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    lipOuter: matte("#C9625C", { roughness: 0.42 }),
    mouthIn: matte("#4A1417", { roughness: 0.6 }),
    tongue: matte("#E27F82", { roughness: 0.55 }),
    teeth: matte("#FFFFFF", { roughness: 0.3 }),
    steel: new Phys({ color: "#E9E6DF", roughness: 0.42, metalness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    bun: new Phys({ color: "#E8A24A", roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45 }),
    bunLight: new Phys({ color: "#F1BC6C", roughness: 0.6 }),
    seed: matte("#FFF0CF", { roughness: 0.5 }),
    patty: matte("#5A3220", { roughness: 0.8 }),
    cheese: new Phys({ color: "#FFC62A", roughness: 0.35, clearcoat: 0.3 }),
    lettuce: new Phys({ color: "#6CC04A", roughness: 0.5, clearcoat: 0.2 }),
    tomato: new Phys({ color: "#E8402B", roughness: 0.35, clearcoat: 0.5 }),
    fries: matte("#F8C13B", { roughness: 0.55 }),
    friesLight: matte("#FFD968", { roughness: 0.55 }),
    cup: matte("#FFFFFF", { roughness: 0.4 }),
    paper: matte("#FFF6E2", { roughness: 0.9 }),
  };
}

/* Texture canvas : badge nominatif de l'équipier (texte paramétrable). */
export function nameTagTexture(name = "LÉO") {
  const c = document.createElement("canvas"); c.width = 256; c.height = 112; const g = c.getContext("2d");
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 256, 112);
  g.fillStyle = COLORS.red; g.fillRect(0, 0, 256, 30);
  g.fillStyle = "#fff"; g.font = "800 20px Montserrat, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ÉQUIPIER", 128, 16);
  g.fillStyle = "#27251F"; g.font = "900 46px Montserrat, Arial, sans-serif"; g.fillText(name.toUpperCase(), 128, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* Texture : halo doux (ombre de contact / lumière). */
export function radialTexture(inner = "rgba(0,0,0,0.55)", outer = "rgba(0,0,0,0)") {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
