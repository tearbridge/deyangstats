// M+ score color thresholds (similar to Raider.IO)
function getScoreColor(score) {
  if (score >= 3500) return '#e268a8'; // Mythic
  if (score >= 3000) return '#ff8000'; // Epic
  if (score >= 2500) return '#a335ee'; // Purple
  if (score >= 2000) return '#0070dd'; // Blue
  if (score >= 1500) return '#1eff00'; // Green
  if (score >= 1000) return '#ffffff'; // White
  return '#9d9d9d'; // Gray
}

export default function ScoreBadge({ score }) {
  const color = getScoreColor(score);
  const formatted = score ? score.toFixed(1) : '0.0';

  return (
    <span
      className="font-bold text-lg tabular-nums"
      style={{ color }}
      title={`M+ Score: ${formatted}`}
    >
      {formatted}
    </span>
  );
}
