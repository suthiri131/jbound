export const VIBES = [
  { id: 'cozy', label: 'Cozy' },
  { id: 'adventurous', label: 'Adventurous' },
  { id: 'regional', label: 'Regional' },
  { id: 'foodie', label: 'Foodie' },
  { id: 'peaceful', label: 'Peaceful' },
  { id: 'chaotic', label: 'Chaotic' },
];

export const VIBE_LABEL = Object.fromEntries(VIBES.map((v) => [v.id, v.label]));

export const VIBE_TINT = {
  cozy: '#E7F2D8',
  adventurous: '#F8D7A7',
  regional: '#D8E6F3',
  foodie: '#F7CACC',
  peaceful: '#DDEAE2',
  chaotic: '#EAD6F7',
};
