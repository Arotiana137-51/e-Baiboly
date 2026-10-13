export interface PrimaryColorOption {
  id: string;
  name: string;
  hex: string;
}

export const DEFAULT_PRIMARY_COLOR_ID = 'defaultTeal';

export const PRIMARY_COLOR_OPTIONS: PrimaryColorOption[] = [
  {id: DEFAULT_PRIMARY_COLOR_ID, name: 'Default', hex: '#007991'},

  // Reds
  {id: 'liturgicalRed', name: 'Liturgical Red', hex: '#C8102E'},
  {id: 'brightRed', name: 'Bright Red', hex: '#BB0A21'},
  {id: 'darkRed', name: 'Dark Red', hex: '#8B0000'},
  {id: 'blood', name: 'Blood', hex: '#6F1D1B'},
  {id: 'wine', name: 'Wine', hex: '#542344'},
  {id: 'deepWine', name: 'Deep Wine', hex: '#461220'},

  // Pinks / magentas
  {id: 'magenta', name: 'Magenta', hex: '#D90368'},
  {id: 'darkPink', name: 'Dark Pink', hex: '#C71585'},
  {id: 'rose', name: 'Rose', hex: '#B6244F'},
  {id: 'liturgicalRose', name: 'Liturgical Rose', hex: '#B76D7C'},

  // Plums / violets
  {id: 'plum', name: 'Plum', hex: '#3A015C'},
  {id: 'liturgicalViolet', name: 'Liturgical Violet', hex: '#4B0082'},
  {id: 'darkPlum', name: 'Dark Plum', hex: '#331832'},

  // Oranges / browns
  {id: 'terracotta', name: 'Terracotta', hex: '#BE5A38'},
  {id: 'brown', name: 'Brown', hex: '#5B3000'},
  {id: 'espresso', name: 'Espresso', hex: '#33261D'},

  // Gold / yellow
  {id: 'liturgicalGold', name: 'Liturgical Gold', hex: '#D4AF37'},
  {id: 'mustard', name: 'Mustard', hex: '#D5A021'},

  // Greens
  {id: 'olive', name: 'Olive', hex: '#3E442B'},
  {id: 'liturgicalGreen', name: 'Liturgical Green', hex: '#006747'},
  {id: 'emerald', name: 'Emerald', hex: '#1E352F'},
  {id: 'pine', name: 'Pine', hex: '#04471C'},
  {id: 'forest', name: 'Forest', hex: '#0D2818'},

  // Blues / indigos
  {id: 'deepNavy', name: 'Deep Navy', hex: '#04395E'},
  {id: 'deepIndigo', name: 'Deep Indigo', hex: '#052F5F'},
  {id: 'midnight', name: 'Midnight', hex: '#1A1B41'},

  // Neutrals
  {id: 'ebony', name: 'Ebony', hex: '#545E56'},
  {id: 'liturgicalBlack', name: 'Liturgical Black', hex: '#000000'},

  // Curated palettes — single accent hex (the theme engine drives accent only;
  // full background/text theming would need a bigger engine change).
  {id: 'sage_green', name: 'Vert Sauge', hex: '#7A9A82'},
  {id: 'mofon_tany', name: 'Mofon-tany Maitso', hex: '#8FBC8F'},
  {id: 'tany_mafana', name: 'Tany Mafana', hex: '#C86432'},
  {id: 'fasika', name: 'Fasika', hex: '#C4A484'},
  {id: 'rahona', name: 'Rahona', hex: '#607D8B'},
  {id: 'divay', name: 'Divay', hex: '#9E2A2B'},

  // Popular, well-designed accents (modern UI palettes — the ones people reach for).
  {id: 'iosBlue', name: 'iOS Blue', hex: '#0A84FF'},
  {id: 'royalBlue', name: 'Royal Blue', hex: '#2563EB'},
  {id: 'sky', name: 'Sky', hex: '#0EA5E9'},
  {id: 'cyan', name: 'Cyan', hex: '#06B6D4'},
  {id: 'teal', name: 'Teal', hex: '#14B8A6'},
  {id: 'indigo', name: 'Indigo', hex: '#6366F1'},
  {id: 'violet', name: 'Violet', hex: '#8B5CF6'},
  {id: 'purple', name: 'Purple', hex: '#A855F7'},
  {id: 'fuchsia', name: 'Fuchsia', hex: '#D946EF'},
  {id: 'pink', name: 'Pink', hex: '#EC4899'},
  {id: 'coral', name: 'Coral', hex: '#F43F5E'},
  {id: 'orange', name: 'Orange', hex: '#F97316'},
  {id: 'amber', name: 'Amber', hex: '#F59E0B'},
  {id: 'lime', name: 'Lime', hex: '#84CC16'},
  {id: 'green', name: 'Green', hex: '#22C55E'},
  {id: 'emeraldBright', name: 'Emerald', hex: '#10B981'},
  {id: 'slate', name: 'Slate', hex: '#64748B'},
];

export const findPrimaryColorOption = (hex: string | null | undefined): PrimaryColorOption | undefined => {
  if (!hex) return undefined;
  const normalized = hex.toLowerCase();
  return PRIMARY_COLOR_OPTIONS.find(o => o.hex.toLowerCase() === normalized);
};
