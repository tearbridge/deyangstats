import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ClassBadge from '../components/ClassBadge';
import ScoreBadge from '../components/ScoreBadge';
import { getCharacter, getCharacterHistory } from '../api';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function KeyLevelBadge({ level }) {
  let color = 'badge-ghost';
  if (level >= 20) color = 'badge-error';
  else if (level >= 15) color = 'badge-warning';
  else if (level >= 10) color = 'badge-info';
  else if (level >= 5) color = 'badge-success';

  return <span className={`badge ${color} font-bold`}>+{level}</span>;
}

export default function CharacterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [charData, histData] = await Promise.all([
          getCharacter(id),
          getCharacterHistory(id),
        ]);
        setCharacter(charData);
        setHistory(histData.history || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-base-300">
      <Navbar />
      <div className="flex justify-center items-center py-32">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    </div>
  );

  if (error || !character) return (
    <div className="min-h-screen bg-base-300">
      <Navbar />
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="alert alert-error max-w-md mx-auto">
          <span>{error || '角色不存在'}</span>
        </div>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>返回首页</button>
      </div>
    </div>
  );

  const profile = character.profile;
  const recentRuns = profile?.mythic_plus_recent_runs || [];
  const bestRuns = profile?.mythic_plus_best_runs || [];
  const scores = profile?.mythic_plus_scores_by_season?.[0]?.scores || {};

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />

      {/* Header */}
      <div className="bg-base-100 border-b border-base-content/10">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate('/')}>
            ← 返回
          </button>

          <div className="flex items-start gap-4">
            {character.profile?.thumbnail_url ? (
              <img
                src={character.profile.thumbnail_url}
                alt={character.name}
                className="w-20 h-20 rounded-2xl border-2 border-primary/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-base-300 flex items-center justify-center text-3xl">🎮</div>
            )}

            <div className="flex-1">
              <h1 className="text-3xl font-wow text-primary">{character.name}</h1>
              <p className="text-base-content/60 text-sm mb-2">
                {character.realm} · {character.region.toUpperCase()}
              </p>
              <ClassBadge className={character.profile?.class} spec={character.profile?.active_spec_name} />
            </div>

            <div className="text-right">
              <ScoreBadge score={character.score} />
              <div className="text-xs text-base-content/50">M+ 总评分</div>
              {character.profile?.profile_url && (
                <a
                  href={character.profile.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-xs btn-outline btn-primary mt-2"
                >
                  Raider.IO ↗
                </a>
              )}
            </div>
          </div>

          {/* Score breakdown */}
          {Object.keys(scores).length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(scores).map(([role, score]) => (
                score > 0 && (
                  <div key={role} className="bg-base-300 rounded-lg p-2 text-center">
                    <div className="text-xs text-base-content/50 capitalize">{role}</div>
                    <div className="font-bold text-sm">{typeof score === 'number' ? score.toFixed(1) : score}</div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Best runs */}
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4">
              <h2 className="card-title text-base font-wow">🏆 本赛季最高记录</h2>
              {bestRuns.length === 0 ? (
                <p className="text-base-content/50 text-sm">暂无记录</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {bestRuns.slice(0, 20).map((run, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-base-content/5 pb-1">
                      <div className="flex items-center gap-2">
                        <KeyLevelBadge level={run.mythic_level} />
                        <span className="truncate max-w-[150px] text-base-content/80">{run.dungeon?.name || run.short_name}</span>
                      </div>
                      <div className="text-right text-xs text-base-content/50">
                        {formatDate(run.completed_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent runs */}
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4">
              <h2 className="card-title text-base font-wow">⏱️ 最近跑本</h2>
              {recentRuns.length === 0 ? (
                <p className="text-base-content/50 text-sm">暂无记录</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {recentRuns.slice(0, 15).map((run, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-base-content/5 pb-1">
                      <div className="flex items-center gap-2">
                        <KeyLevelBadge level={run.mythic_level} />
                        <div>
                          <div className="truncate max-w-[130px] text-base-content/80">{run.dungeon?.name || run.short_name}</div>
                          <div className="text-xs text-base-content/40">{formatDate(run.completed_at)}</div>
                        </div>
                      </div>
                      <div className={`text-xs font-semibold ${run.num_keystone_upgrades > 0 ? 'text-success' : 'text-error'}`}>
                        {run.num_keystone_upgrades > 0 ? `+${run.num_keystone_upgrades}升` : '未升'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score history chart (simple) */}
        {history.length > 1 && (
          <div className="card bg-base-100 shadow mt-6">
            <div className="card-body p-4">
              <h2 className="card-title text-base font-wow">📈 评分历史</h2>
              <div className="flex items-end gap-1 h-24 mt-2">
                {history.map((snap, i) => {
                  const maxScore = Math.max(...history.map(s => s.score || 0));
                  const height = maxScore > 0 ? ((snap.score || 0) / maxScore) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary/70 rounded-t hover:bg-primary transition-colors"
                      style={{ height: `${height}%` }}
                      title={`${snap.score?.toFixed(1)} · ${formatDate(snap.fetched_at)}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-base-content/40 mt-1">
                <span>{formatDate(history[0]?.fetched_at)}</span>
                <span>{formatDate(history[history.length - 1]?.fetched_at)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
