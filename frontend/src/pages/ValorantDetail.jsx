import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getValPlayer } from '../api';

const TIER_EMOJI = {
  'Unrated': '⬜',
  'Iron 1': '⚫', 'Iron 2': '⚫', 'Iron 3': '⚫',
  'Bronze 1': '🟤', 'Bronze 2': '🟤', 'Bronze 3': '🟤',
  'Silver 1': '⚪', 'Silver 2': '⚪', 'Silver 3': '⚪',
  'Gold 1': '🟡', 'Gold 2': '🟡', 'Gold 3': '🟡',
  'Platinum 1': '🔵', 'Platinum 2': '🔵', 'Platinum 3': '🔵',
  'Diamond 1': '💎', 'Diamond 2': '💎', 'Diamond 3': '💎',
  'Ascendant 1': '🌿', 'Ascendant 2': '🌿', 'Ascendant 3': '🌿',
  'Immortal 1': '🔴', 'Immortal 2': '🔴', 'Immortal 3': '🔴',
  'Radiant': '🌟',
};

function getTierEmoji(tier) {
  return TIER_EMOJI[tier] || '⬜';
}

const RANK_COLORS = {
  'Iron': 'text-gray-400', 'Bronze': 'text-amber-600', 'Silver': 'text-gray-300',
  'Gold': 'text-yellow-400', 'Platinum': 'text-cyan-400', 'Diamond': 'text-blue-400',
  'Ascendant': 'text-green-400', 'Immortal': 'text-red-400', 'Radiant': 'text-yellow-300',
};

function getRankColor(tier) {
  if (!tier) return 'text-base-content/60';
  const base = tier.split(' ')[0];
  return RANK_COLORS[base] || 'text-base-content/60';
}

function RRChange({ change }) {
  if (change === null || change === undefined) return null;
  const positive = change >= 0;
  return (
    <span className={`text-xs font-bold ml-1 ${positive ? 'text-success' : 'text-error'}`}>
      {positive ? '+' : ''}{change}
    </span>
  );
}

export default function ValorantDetail() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getValPlayer(id)
      .then(setPlayer)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-base-300">
      <Navbar />
      <div className="flex justify-center items-center py-40">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    </div>
  );

  if (error || !player) return (
    <div className="min-h-screen bg-base-300">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="alert alert-error">⚠️ {error || '玩家不存在'}</div>
        <Link to="/valorant" className="btn btn-ghost mt-4">← 返回</Link>
      </div>
    </div>
  );

  const cardUrl = player.account?.card?.wide || player.account?.card?.large || null;
  const avatarUrl = player.account?.card?.small || null;

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />

      {/* Header with card banner */}
      <div className="relative overflow-hidden">
        {cardUrl && (
          <img src={cardUrl} alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-30 pointer-events-none select-none" />
        )}
        <div className="relative z-10 bg-gradient-to-b from-transparent to-base-300 py-6 px-4">
          <div className="container mx-auto max-w-2xl">
            <Link to="/valorant" className="btn btn-ghost btn-sm mb-3">← 返回</Link>
            <div className="flex items-center gap-4">
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="w-16 h-16 rounded-lg border-2 border-primary shadow-lg shrink-0"
                />
              )}
              {!player.account?.card?.small && (
                <div className="text-5xl w-16 text-center">{getTierEmoji(player.tier)}</div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">{player.name}</h1>
                  {player.account?.level && (
                    <span className="badge badge-primary badge-outline text-xs font-bold">Lv.{player.account.level}</span>
                  )}
                </div>
                <p className="text-base-content/50">{player.riot_id}#{player.tagline} · {player.region.toUpperCase()}</p>
                <p className={`text-xl font-bold mt-1 ${getRankColor(player.tier)}`}>
                  {getTierEmoji(player.tier)} {player.tier || 'Unrated'} · {player.rr} RR
                </p>
                {player.peak && (
                  <p className="text-sm text-base-content/40">历史最高：{getTierEmoji(player.peak)} {player.peak}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">

        {/* MMR History (RR changes) */}
        {player.mmr_history_recent && player.mmr_history_recent.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">📈 近期 RR 变动</h2>
            <div className="card bg-base-100 shadow">
              <div className="card-body p-4">
                <div className="flex flex-wrap gap-2">
                  {player.mmr_history_recent.map((h, i) => {
                    const positive = (h.change || 0) >= 0;
                    return (
                      <div key={i} className="flex flex-col items-center min-w-[52px]">
                        <span className="text-xs text-base-content/40 mb-0.5">{h.rr} RR</span>
                        <span className={`text-sm font-bold ${positive ? 'text-success' : 'text-error'}`}>
                          {positive ? '+' : ''}{h.change ?? '?'}
                        </span>
                        <span className="text-[10px] text-base-content/30 mt-0.5 truncate max-w-[52px] text-center">{h.map || ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent matches */}
        <h2 className="text-xl font-bold mb-4">📋 近期对局</h2>
        {!player.matches || player.matches.length === 0 ? (
          <div className="text-base-content/50 text-center py-10">暂无对局数据</div>
        ) : (
          <div className="flex flex-col gap-3">
            {player.matches.map((m, i) => {
              const kda = m.kills !== undefined ? `${m.kills}/${m.deaths}/${m.assists}` : '-/-/-';
              const kdaRatio = m.deaths > 0
                ? ((m.kills + (m.assists || 0) * 0.5) / m.deaths).toFixed(2)
                : (m.kills ?? 0).toFixed(2);
              const wonBorder = m.won === true
                ? 'border-l-4 border-success'
                : m.won === false ? 'border-l-4 border-error' : '';

              return (
                <div key={i} className={`card bg-base-100 shadow ${wonBorder}`}>
                  <div className="card-body p-4">
                    {/* Top row */}
                    <div className="flex items-center gap-3">
                      <div className="text-2xl w-8 text-center shrink-0">
                        {m.won === true ? '✅' : m.won === false ? '❌' : '➖'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold">{m.map || '未知地图'}</span>
                          {m.mvp && <span className="badge badge-warning badge-xs">MVP</span>}
                        </div>
                        <div className="text-sm text-base-content/50">
                          {m.agent || '未知 Agent'} · {m.mode || ''}
                        </div>
                        {m.date && <div className="text-xs text-base-content/30">{m.date}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold">{kda}</div>
                        <div className="text-xs text-base-content/50">KDA {kdaRatio}</div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-base-content/60 border-t border-base-content/10 pt-2">
                      {m.hs_pct !== null && m.hs_pct !== undefined && (
                        <span>🎯 爆头率 <span className={`font-bold ${m.hs_pct >= 30 ? 'text-success' : m.hs_pct >= 15 ? 'text-warning' : 'text-base-content/60'}`}>{m.hs_pct}%</span></span>
                      )}
                      {m.damage_made != null && (
                        <span>💥 伤害 <span className="font-bold text-base-content/80">{m.damage_made}</span></span>
                      )}
                      {m.score != null && (
                        <span>🏆 战斗分 <span className="font-bold text-base-content/80">{m.score}</span></span>
                      )}
                      {m.plants > 0 && (
                        <span>💣 植弹 <span className="font-bold text-warning">{m.plants}</span></span>
                      )}
                      {m.defuses > 0 && (
                        <span>🛡️ 拆弹 <span className="font-bold text-info">{m.defuses}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="text-center py-6 text-base-content/30 text-xs">
        <p>deyangstats · 数据由 <a href="https://henrikdev.xyz" target="_blank" rel="noopener noreferrer" className="link">Henrik's API</a> 提供</p>
      </footer>
    </div>
  );
}
