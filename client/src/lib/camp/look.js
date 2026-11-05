/**
 * What a camp character can look like. Shared by the 3D builder (avatar.js) and the flat 2D one (AvatarFlat.vue).
 * The style ids must match lookBody in server/routes/schemas.js.
 */
export const DEFAULT_LOOK = {
  skin: "#c68b59",
  hair: "#2b1d14",
  hairStyle: "short",
  top: "#e2603f",
  bottom: "#2f4858",
  hat: "none",
};

export const LOOK_OPTIONS = {
  skin: ["#f3d2b3", "#e8b48a", "#c68b59", "#a0663c", "#6e4325", "#4a2c17"],
  hair: [
    "#1b1410",
    "#2b1d14",
    "#6b3f1f",
    "#b5793a",
    "#e3c27a",
    "#8c8c8c",
    "#c2412d",
    "#3b5bdb",
  ],
  hairStyle: ["short", "long", "bun", "buzz", "curly"],
  top: [
    "#e2603f",
    "#f2b134",
    "#3f8f5b",
    "#2f7fbf",
    "#7a4fbf",
    "#e86fa0",
    "#f4efe2",
    "#2a2f36",
  ],
  bottom: ["#2f4858", "#3d3a36", "#7a5a3a", "#4f6d3a", "#c9b48f", "#1f2a44"],
  hat: ["none", "cap", "bucket", "beanie"],
};

export const STYLE_LABEL = {
  short: "Short",
  long: "Long",
  bun: "Bun",
  buzz: "Buzz",
  curly: "Curly",
  none: "No hat",
  cap: "Cap",
  bucket: "Bucket hat",
  beanie: "Beanie",
};

export function normaliseLook(look) {
  const out = { ...DEFAULT_LOOK };
  if (!look || typeof look !== "object") return out;
  for (const key of Object.keys(DEFAULT_LOOK)) {
    const value = look[key];
    if (key === "hairStyle" || key === "hat") {
      if (LOOK_OPTIONS[key].includes(value)) out[key] = value;
    } else if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value))
      out[key] = value;
  }
  return out;
}

/** A stable made-up look for someone who never picked one, so crewmates do not all look identical. */
export function lookFromId(id = "") {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (list, salt) => list[(h >>> salt) % list.length];
  return {
    skin: pick(LOOK_OPTIONS.skin, 1),
    hair: pick(LOOK_OPTIONS.hair, 4),
    hairStyle: pick(LOOK_OPTIONS.hairStyle, 7),
    top: pick(LOOK_OPTIONS.top, 10),
    bottom: pick(LOOK_OPTIONS.bottom, 13),
    hat: pick(LOOK_OPTIONS.hat, 16),
  };
}
