export const PALETTE_KEY = "khu-phaen-palette";

type PaletteBase = { id: string; labelKey: string };
/** Hue presets: a single hue drives every color. */
type HuePalette = PaletteBase & { group: "colors"; hue: number };
/** Fixed themes with their own light and dark variants (see globals.css). */
type FixedPalette = PaletteBase & { group: "dracula" | "catppuccin"; swatch: [string, string] };

export const PALETTES = [
  { id: "violet", group: "colors", hue: 285, labelKey: "layout__palette_violet" },
  { id: "blue", group: "colors", hue: 255, labelKey: "layout__palette_blue" },
  { id: "teal", group: "colors", hue: 195, labelKey: "layout__palette_teal" },
  { id: "emerald", group: "colors", hue: 160, labelKey: "layout__palette_emerald" },
  { id: "orange", group: "colors", hue: 50, labelKey: "layout__palette_orange" },
  { id: "rose", group: "colors", hue: 10, labelKey: "layout__palette_rose" },
  { id: "dracula", group: "dracula", swatch: ["#bd93f9", "#ff79c6"], labelKey: "layout__palette_dracula" },
  {
    id: "catppuccin-mocha",
    group: "catppuccin",
    swatch: ["#cba6f7", "#1e1e2e"],
    labelKey: "layout__palette_catppuccin_mocha",
  },
  {
    id: "catppuccin-macchiato",
    group: "catppuccin",
    swatch: ["#c6a0f6", "#24273a"],
    labelKey: "layout__palette_catppuccin_macchiato",
  },
  {
    id: "catppuccin-frappe",
    group: "catppuccin",
    swatch: ["#ca9ee6", "#303446"],
    labelKey: "layout__palette_catppuccin_frappe",
  },
] as const satisfies readonly (HuePalette | FixedPalette)[];

export type Palette = (typeof PALETTES)[number];
export type PaletteId = Palette["id"];
export type PaletteGroup = Palette["group"];
export const DEFAULT_PALETTE: PaletteId = "violet";

export const PALETTE_GROUPS: { id: PaletteGroup; labelKey: string }[] = [
  { id: "colors", labelKey: "layout__palette_group_colors" },
  { id: "dracula", labelKey: "layout__palette_group_dracula" },
  { id: "catppuccin", labelKey: "layout__palette_group_catppuccin" },
];

export function isPaletteId(value: string | null): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

export function paletteSwatch(p: Palette): string {
  return "hue" in p
    ? `linear-gradient(135deg, oklch(0.6 0.22 ${p.hue}), oklch(0.68 0.22 ${p.hue + 35}))`
    : `linear-gradient(135deg, ${p.swatch[0]} 50%, ${p.swatch[1]} 50%)`;
}

/** Runs before first paint (inlined in <head>) so the saved palette never flashes the default. */
export const PALETTE_INIT_SCRIPT = `try{var p=localStorage.getItem(${JSON.stringify(PALETTE_KEY)});if(p)document.documentElement.setAttribute("data-palette",p)}catch(e){}`;
