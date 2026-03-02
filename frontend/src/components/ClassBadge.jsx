// WoW class colors
const CLASS_COLORS = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  'Druid': '#FF7C0A',
  'Evoker': '#33937F',
  'Hunter': '#AAD372',
  'Mage': '#3FC7EB',
  'Monk': '#00FF98',
  'Paladin': '#F48CBA',
  'Priest': '#FFFFFF',
  'Rogue': '#FFF468',
  'Shaman': '#0070DD',
  'Warlock': '#8788EE',
  'Warrior': '#C69B3A',
};

const CLASS_ICONS = {
  'Death Knight': '💀',
  'Demon Hunter': '🦋',
  'Druid': '🌿',
  'Evoker': '🐉',
  'Hunter': '🏹',
  'Mage': '🔮',
  'Monk': '☯️',
  'Paladin': '✨',
  'Priest': '⛪',
  'Rogue': '🗡️',
  'Shaman': '⚡',
  'Warlock': '🔥',
  'Warrior': '⚔️',
};

export default function ClassBadge({ className, spec }) {
  const color = CLASS_COLORS[className] || '#888';
  const icon = CLASS_ICONS[className] || '🎮';

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}44` }}
    >
      <span>{icon}</span>
      <span>{spec ? `${spec} ${className}` : (className || '未知职业')}</span>
    </span>
  );
}
