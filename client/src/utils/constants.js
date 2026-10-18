export const VIBES = [
  { id: "cozy", label: "Cozy" },
  { id: "adventure", label: "Adventurous" },
  { id: "culture", label: "Regional" },
  { id: "eating", label: "Foodie" },
  { id: "activities", label: "Activities" },
  { id: "peaceful", label: "Peaceful" },
  { id: "chaotic", label: "Chaotic" },
];

export const VIBE_LABEL = Object.fromEntries(VIBES.map((v) => [v.id, v.label]));

/** Stroke icon paths (24×24) per vibe — used by VibeIcon */
export const VIBE_ICON = {
  eating: 'M3 11h18a9 9 0 0 1-18 0ZM8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3',
  activities: 'M5 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0ZM12 3v14M5 10h14M7 5l10 10M17 5 7 15M9 21l3-4 3 4',
  culture: 'M3 9 12 4l9 5M5 9v9M19 9v9M9.5 9v9M14.5 9v9M3 20h18',
  adventure: 'm2 20 7-12 4 6 3-4 6 10ZM16 5a2 2 0 1 0 4 0a2 2 0 1 0-4 0Z',
};


export const VIBE_TINT = {
  eating: "#F7CACC", 
  activities: "#E7F2D8",
  culture: "#D8E6F3",
  adventure: "#F8D7A7",
  cozy: "#E7F2D8",
  chaotic: "#EAD6F7",
  peaceful: "#DDEAE2"
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