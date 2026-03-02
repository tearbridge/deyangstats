import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getValPlayers } from '../api';

const TIER_EMOJI = {
  'Unrated': '⬜',
  'Iron': '⚫', 'Iron 1': '⚫', 'Iron 2': '⚫', 'Iron 3': '⚫',
  'Bronze': '🟤', 'Bronze 1': '🟤', 'Bronze 2': '🟤', 'Bronze 3': '🟤',
  'Silver': '⚪', 'Silver 1': '⚪', 'Silver 2': '⚪', 'Silver 3': '⚪',
  'Gold': '🟡', 'Gold 1': '🟡', 'Gold 2': '🟡', 'Gold 3': '🟡',
  'Platinum': '🔵', 'Platinum 1': '🔵', 'Platinum 2': '🔵', 'Platinum 3': '🔵',
  'Diamond': '💎', 'Diamond 1': '💎', 'Diamond 2': '💎', 'Diamond 3': '💎',
  'Ascendant': '🌿', 'Ascendant 1': '🌿', 'Ascendant 2': '🌿', 'Ascendant 3': '🌿',
  'Immortal': '🔴', 'Immortal 1': '🔴', 'Immortal 2': '🔴', 'Immortal 3': '🔴',
  'Radiant': '🌟',
};

function getTierEmoji(tier) {
  if (!tier) return '⬜';
  return TIER_EMOJI[tier] || '⬜';
}

const RANK_COLORS = {
  'Iron': 'text-gray-400',
  'Bronze': 'text-amber-600',
  'Silver': 'text-gray-300',
  'Gold': 'text-yellow-400',
  'Platinum': 'text-cyan-400',
  'Diamond': 'text-blue-400',
  'Ascendant': 'text-green-400',
  'Immortal': 'text-red-400',
  'Radiant': 'text-yellow-300',
};

function getRankColor(tier) {
  if (!tier) return 'text-base-content/60';
  const base = tier.split(' ')[0];
  return RANK_COLORS[base] || 'text-base-content/60';
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

export default function Valorant() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = async () => {
    try {
      setError(null);
      const data = await getValPlayers();
      setPlayers(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />

      <div className="bg-gradient-to-b from-base-100 to-base-300 py-8 px-4 text-center">
        <h1 className="text-4xl font-title-cn text-primary mb-2">🎯 德阳小队</h1>
        <p className="text-base-content/60">Valorant 段位追踪 · 日服 AP</p>
        {lastUpdated && (
          <p className="text-xs text-base-content/40 mt-1">
            更新于 {lastUpdated.toLocaleTimeString('zh-CN')}
          </p>
        )}
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {loading && (
          <div className="flex justify-center items-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <span className="ml-3 text-base-content/60">加载中...</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4">
            <span>⚠️ {error}</span>
            <button className="btn btn-sm btn-ghost" onClick={load}>重试</button>
          </div>
        )}

        {!loading && !error && players.length === 0 && (
          <div className="text-center py-20 text-base-content/50">
            <p className="text-5xl mb-4">🎯</p>
            <p className="text-lg">还没有玩家</p>
            <p className="text-sm mt-2">
              前往 <a href="/admin" className="link link-primary">管理页</a> 添加第一个玩家
            </p>
          </div>
        )}

        {!loading && players.length > 0 && (
          <>
            <div className="stats stats-horizontal shadow w-full mb-6 bg-base-100">
              <div className="stat">
                <div className="stat-title">队员数量</div>
                <div className="stat-value text-primary">{players.length}</div>
              </div>
              <div className="stat">
                <div className="stat-title">最高段位</div>
                <div className="stat-value text-secondary text-2xl">{getTierEmoji(players[0]?.tier)} {players[0]?.tier || '-'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player, idx) => (
                <Link key={player.id} to={`/valorant/${player.id}`} className="card bg-base-100 shadow hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="card-body p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl w-10 text-center">{idx + 1 <= 3 ? ['🥇','🥈','🥉'][idx] : `#${idx+1}`}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-lg truncate">{player.name}</div>
                        <div className="text-base-content/50 text-sm">{player.riot_id}#{player.tagline}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-bold text-lg ${getRankColor(player.tier)}`}>
                          {getTierEmoji(player.tier)} {player.tier || 'Unrated'}
                        </div>
                        <div className="text-base-content/50 text-sm">{player.rr} RR</div>
                      </div>
                    </div>
                    {player.peak && player.peak !== player.tier && (
                      <div className="text-xs text-base-content/40 mt-1">
                        历史最高：{getTierEmoji(player.peak)} {player.peak}
                      </div>
                    )}
                    {player.fetched_at && (
                      <div className="text-xs text-base-content/30 mt-1">
                        {timeAgo(player.fetched_at)}更新
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="text-center py-6 text-base-content/30 text-xs">
        <p>deyangstats · 数据由 <a href="https://henrikdev.xyz" target="_blank" rel="noopener noreferrer" className="link">Henrik's API</a> 提供</p>
      </footer>
    </div>
  );
}
