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

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />

      <div className="bg-gradient-to-b from-base-100 to-base-300 py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <Link to="/valorant" className="btn btn-ghost btn-sm mb-4">← 返回</Link>
          <div className="flex items-center gap-4">
            <div className="text-6xl">{getTierEmoji(player.tier)}</div>
            <div>
              <h1 className="text-3xl font-bold">{player.name}</h1>
              <p className="text-base-content/50">{player.riot_id}#{player.tagline} · {player.region.toUpperCase()}</p>
              <p className={`text-xl font-bold mt-1 ${getRankColor(player.tier)}`}>
                {player.tier || 'Unrated'} · {player.rr} RR
              </p>
              {player.peak && (
                <p className="text-sm text-base-content/40">历史最高：{getTierEmoji(player.peak)} {player.peak}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Recent matches */}
        <h2 className="text-xl font-bold mb-4">📋 近期对局</h2>
        {!player.matches || player.matches.length === 0 ? (
          <div className="text-base-content/50 text-center py-10">暂无对局数据</div>
        ) : (
          <div className="flex flex-col gap-3">
            {player.matches.map((m, i) => {
              const kda = m.kills !== undefined
                ? `${m.kills}/${m.deaths}/${m.assists}`
                : '-/-/-';
              const kdaRatio = m.deaths > 0 ? ((m.kills + m.assists * 0.5) / m.deaths).toFixed(2) : m.kills?.toFixed(2) || '-';
              const wonColor = m.won === true ? 'border-l-4 border-success' : m.won === false ? 'border-l-4 border-error' : '';
              return (
                <div key={i} className={`card bg-base-100 shadow ${wonColor}`}>
                  <div className="card-body p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl w-8 text-center">
                        {m.won === true ? '✅' : m.won === false ? '❌' : '➖'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold">{m.map || '未知地图'}</div>
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
