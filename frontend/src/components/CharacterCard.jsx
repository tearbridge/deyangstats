import { useNavigate } from 'react-router-dom';
import ClassBadge from './ClassBadge';
import ScoreBadge from './ScoreBadge';

export default function CharacterCard({ character, rank, season }) {
  const navigate = useNavigate();

  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
  const rankEmojis = ['🥇', '🥈', '🥉'];
  const rankDisplay = rank <= 3 ? rankEmojis[rank - 1] : `#${rank}`;

  const timeAgo = (dateStr) => {
    if (!dateStr) return '从未';
    const diff = Date.now() - new Date(dateStr + 'Z').getTime();
    if (diff < 0) return '刚刚';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  return (
    <div
      className="card bg-base-100 shadow-xl hover:shadow-purple-900/30 hover:scale-[1.02] transition-all cursor-pointer border border-base-content/10 hover:border-primary/40"
      onClick={() => navigate(`/character/${character.id}${season ? `?season=${season}` : ''}`)}
    >
      <div className="card-body p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="avatar placeholder">
            {character.thumbnail_url ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden">
                <img src={`/api/proxy/avatar?url=${encodeURIComponent(character.thumbnail_url)}`} alt={character.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="bg-neutral text-neutral-content rounded-xl w-14 h-14">
                <span className="text-xl">🎮</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xl font-bold ${rankColors[rank - 1] || 'text-base-content'}`}>
                {rankDisplay}
              </span>
              <h2 className="card-title font-wow text-base truncate">{character.name}</h2>
            </div>

            <div className="text-xs text-base-content/60 mb-1">
              {character.realm} · {character.region.toUpperCase()}
            </div>

            <ClassBadge className={character.class} spec={character.active_spec_name} />
          </div>

          {/* Score */}
          <div className="text-right shrink-0">
            <ScoreBadge score={character.score} />
            <div className="text-xs text-base-content/50 mt-0.5">M+ 评分</div>
          </div>
        </div>

        {/* Weekly best */}
        {character.weekly_best && (
          <div className="mt-2 pt-2 border-t border-base-content/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-base-content/60">本周最高</span>
              <span className="flex items-center gap-1 font-semibold text-success">
                <span>+{character.weekly_best.mythic_level}</span>
                <span className="text-xs text-base-content/60 font-normal truncate max-w-[150px]">
                  {character.weekly_best.dungeon}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Last updated */}
        <div className="text-xs text-base-content/40 mt-1">
          更新于 {timeAgo(character.fetched_at)}
        </div>
      </div>
    </div>
  );
}
