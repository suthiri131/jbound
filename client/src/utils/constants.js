export const VIBES = [
  { id: "cozy", label: "Cozy" },
  { id: "adventurous", label: "Adventurous" },
  { id: "regional", label: "Regional" },
  { id: "foodie", label: "Foodie" },
  { id: "peaceful", label: "Peaceful" },
  { id: "chaotic", label: "Chaotic" },
];

export const VIBE_LABEL = Object.fromEntries(VIBES.map((v) => [v.id, v.label]));

export const VIBE_TINT = {
  cozy: "#E7F2D8",
  adventurous: "#F8D7A7",
  regional: "#D8E6F3",
  foodie: "#F7CACC",
  peaceful: "#DDEAE2",
  chaotic: "#EAD6F7",
};

export const COVER_COLORS = [
  "#2E5A3C",
  "#B4471F",
  "#1F4E5A",
  "#8A5A2B",
  "#5A3E6B",
];

export const PHASE_STAMP = {
  planning: { label: "PLANNING", color: "#B4471F" },
  on_the_road: { label: "ON THE ROAD", color: "#2E5A3C" },
  memory_box: { label: "MEMORY BOX", color: "#1F4E5A" },
  archived: { label: "ARCHIVED", color: "#5A4A36" },
};
