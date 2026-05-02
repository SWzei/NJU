const TAG_COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#d946ef', '#f59e0b', '#84cc16', '#10b981',
  '#ef4444', '#0ea5e9', '#8b5a2b', '#64748b', '#d97706',
  '#7c3aed', '#db2777', '#059669', '#0891b2', '#4f46e5',
];

const INSTRUMENT_COLOR_MAP = {
  piano: '#e8e8e8',
  violin: '#daa520',
  viola: '#f0a500',
  cello: '#c41e3a',
  contrabass: '#8b5a2b',
  flute: '#87ceeb',
  oboe: '#32cd32',
  clarinet: '#9370db',
  bassoon: '#d2b48c',
  horn: '#b87333',
  trumpet: '#ffd700',
  trombone: '#778899',
  tuba: '#4169e1',
  timpani: '#708090',
  harp: '#fffafa',
  celesta: '#e0e6ed',
  cymbals: '#c0c0c0',
  guitar: '#cd853f',
  string: '#deb887',
  wind: '#5eb3d9',
  organ: '#b8860b',
  euphonium: '#9b59b6',
  score: '#64748b',
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + 1) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getTagColor(name) {
  if (!name) return '#64748b';
  const key = name.toLowerCase();
  const fixed = INSTRUMENT_COLOR_MAP[key];
  if (fixed) return fixed;
  return TAG_COLOR_PALETTE[hashString(key) % TAG_COLOR_PALETTE.length];
}

export function tagStyle(name) {
  const color = getTagColor(name);
  return {
    color,
    backgroundColor: color + '14',
    borderColor: color + '33',
  };
}
