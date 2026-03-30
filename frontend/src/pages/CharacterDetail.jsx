import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const season = searchParams.get('season');
  const [character, setCharacter] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const url = season ? `/api/characters/${id}?season=${season}` : `/api/characters/${id}`;
        const charRes = await fetch(url);
        if (!charRes.ok) throw new Error('Failed to fetch character');
        const charData = await charRes.json();
        setCharacter(charData);
        // Only fetch history for current season (cached data)
        if (!season) {
          const histData = await getCharacterHistory(id);
          setHistory(histData.history || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, season]);

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
  const recentRuns = season ? [] : (profile?.mythic_plus_recent_runs || []);
  const bestRuns = season ? [] : (profile?.mythic_plus_best_runs || []);
  const scores = profile?.mythic_plus_scores_by_season?.[0]?.scores || {};

  // CN dungeon name mapping (short_name → 中文)
  const DUNGEON_CN = {
    // Midnight S1 (12.0)
    WS:   '风行者之塔',
    MC:   '迈萨拉洞窟',
    NPX:  '节点希纳斯',
    MT:   '魔导师平台',
    POS:  '萨隆矿坑',
    AA:   '艾杰斯亚学院',
    SR:   '通天峰',
    SEAT: '执政团之座',
    // TWW S2 (in case of old data)
    BREW: '酿酒大师',
    COT:  '时间洞穴',
    FALL: '诺坎德',
    GB:   '格里姆巴托',
    MISTS:'迷雾',
    SBG:  '暗影月谷',
    SIEGE:'太阳之石守卫',
    WM:   '瓦勒沙拉',
    // TWW S1
    ARAK: '艾拉卡拉，回响之城',
    DAWN: '破晨号',
    FLOOD:'水闸行动',
    PSF:  '圣焰隐修院',
    HOA:  '赎罪大厅',
    EDA:  '奥尔达尼生态圆顶',
    STRT: '塔扎维什：琳彩天街',
    GMBT: '塔扎维什：索·莉亚的宏图',
  };

  // Aggregate best runs by dungeon for heatmap
  const dungeonMap = {};
  for (const run of bestRuns) {
    const shortName = run.short_name || run.dungeon?.short_name || '?';
    const engName = run.dungeon || run.dungeon?.name || shortName;
    const cnName = DUNGEON_CN[shortName] || shortName;
    if (!dungeonMap[shortName] || run.mythic_level > dungeonMap[shortName].mythic_level) {
      dungeonMap[shortName] = { shortName, cnName, engName, mythic_level: run.mythic_level, score: run.score || 0 };
    }
  }
  const dungeonList = Object.values(dungeonMap).sort((a, b) => b.mythic_level - a.mythic_level);

  // Gear slots
  const GEAR_SLOTS = [
    { key: 'head', label: '头部' },
    { key: 'neck', label: '颈部' },
    { key: 'shoulder', label: '肩部' },
    { key: 'back', label: '披风' },
    { key: 'chest', label: '胸部' },
    { key: 'wrist', label: '护腕' },
    { key: 'hands', label: '手部' },
    { key: 'waist', label: '腰部' },
    { key: 'legs', label: '腿部' },
    { key: 'feet', label: '脚部' },
    { key: 'finger1', label: '戒指1' },
    { key: 'finger2', label: '戒指2' },
    { key: 'trinket1', label: '饰品1' },
    { key: 'trinket2', label: '饰品2' },
    { key: 'mainhand', label: '主手' },
    { key: 'offhand', label: '副手' },
  ];
  const gearItems = profile?.gear?.items || {};
  const gearAvgIlvl = profile?.gear?.item_level_equipped || null;

  // Ranks
  const ranks = profile?.mythic_plus_ranks || null;
  const activeSpec = profile?.active_spec_name?.toLowerCase();
  // Determine role from scores or spec name
  const isHealer = activeSpec && ['holy', 'restoration', 'discipline', 'mistweaver', 'preservation'].some(s => activeSpec.includes(s));
  const isTank = activeSpec && ['protection', 'blood', 'brewmaster', 'guardian', 'vengeance'].some(s => activeSpec.includes(s));
  const classRoleKey = isHealer ? 'class_healer' : isTank ? 'class_tank' : 'class_dps';

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />

      {/* Header */}
      <div className="bg-base-100 border-b border-base-content/10">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate(season ? `/?season=${season}` : '/')}>
            ← 返回
          </button>
          {season && (
            <div className="badge badge-info mb-3">📜 {season}</div>
          )}

          <div className="flex items-start gap-4">
            {character.profile?.thumbnail_url ? (
              <img
                src={`/api/proxy/avatar?url=${encodeURIComponent(character.profile.thumbnail_url)}`}
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
              {[
                { key: 'all', label: '综合' },
                { key: 'dps', label: '输出' },
                { key: 'healer', label: '治疗' },
                { key: 'tank', label: '坦克' },
              ].map(({ key, label }) => (
                scores[key] > 0 && (
                  <div key={key} className="bg-base-300 rounded-lg p-2 text-center">
                    <div className="text-xs text-base-content/50">{label}</div>
                    <div className="font-bold text-sm">{scores[key].toFixed(1)}</div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Ranks */}
        {ranks && (ranks.overall?.realm > 0 || ranks.class?.realm > 0) && (
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body p-4">
              <h2 className="card-title text-base font-wow">🏅 服务器排名</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {[
                  { key: 'overall',     label: '综合全服' },
                  { key: 'class',       label: '职业全服' },
                  { key: classRoleKey,  label: isHealer ? '职业治疗' : isTank ? '职业坦克' : '职业输出' },
                  { key: 'overall',     label: '本服综合', sub: 'realm' },
                ].map(({ key, label, sub = null }, i) => {
                  const scope = sub || 'world';
                  const val = ranks[key]?.[scope];
                  if (!val || val === 0) return null;
                  return (
                    <div key={i} className="bg-base-300 rounded-lg p-3 text-center">
                      <div className="text-xs text-base-content/50 mb-1">{label}</div>
                      <div className="font-bold text-lg text-primary">#{val.toLocaleString()}</div>
                      <div className="text-xs text-base-content/30">{sub === 'realm' ? '服务器' : '全球'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Recent runs */}
          <div className="card bg-base-100 shadow">
            <div className="card-body p-4">
              <h2 className="card-title text-base font-wow">⏱️ 最近跑本</h2>
              {recentRuns.length === 0 ? (
                <p className="text-base-content/50 text-sm">{season ? '历史赛季跑本记录不开放' : '暂无记录'}</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {recentRuns.slice(0, 15).map((run, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-base-content/5 pb-1">
                      <div className="flex items-center gap-2">
                        <KeyLevelBadge level={run.mythic_level} />
                        <div>
                          <div className="truncate max-w-[130px] text-base-content/80">{DUNGEON_CN[run.short_name] || run.dungeon?.name || run.short_name}</div>
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

        {/* Dungeon heatmap */}
        {dungeonList.length > 0 && (
          <div className="card bg-base-100 shadow mt-6">
            <div className="card-body p-4">
              <h2 className="card-title text-base font-wow">🗺️ 副本最高层数</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {dungeonList.map((d) => {
                  let bg = 'bg-base-300';
                  let textColor = 'text-base-content/70';
                  if (d.mythic_level >= 20) { bg = 'bg-error/20'; textColor = 'text-error'; }
                  else if (d.mythic_level >= 15) { bg = 'bg-warning/20'; textColor = 'text-warning'; }
                  else if (d.mythic_level >= 10) { bg = 'bg-info/20'; textColor = 'text-info'; }
                  else if (d.mythic_level >= 5)  { bg = 'bg-success/20'; textColor = 'text-success'; }
                  return (
                    <div key={d.shortName} className={`${bg} rounded-lg p-3 text-center`}>
                      <div className="text-xs text-base-content/50 truncate mb-1" title={d.shortName}>{d.cnName}</div>
                      <div className={`text-2xl font-bold ${textColor}`}>+{d.mythic_level}</div>
                      {d.score > 0 && (
                        <div className="text-xs text-primary mt-0.5">{d.score.toFixed(1)} 分</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Gear panel */}
        {Object.keys(gearItems).length > 0 && (
          <div className="card bg-base-100 shadow mt-6">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="card-title text-base font-wow">⚔️ 当前装备</h2>
                {gearAvgIlvl && (
                  <span className="badge badge-primary badge-lg font-bold">均装 {gearAvgIlvl}</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {GEAR_SLOTS.map(({ key, label }) => {
                  const item = gearItems[key];
                  if (!item) return (
                    <div key={key} className="flex items-center gap-2 bg-base-300/50 rounded px-2 py-1.5">
                      <span className="text-xs text-base-content/30 w-10 shrink-0">{label}</span>
                      <span className="text-xs text-base-content/20">—</span>
                    </div>
                  );
                  const ilvl = item.item_level || 0;
                  let ilvlColor = 'text-base-content/70';
                  if (ilvl >= 639) ilvlColor = 'text-yellow-400';
                  else if (ilvl >= 626) ilvlColor = 'text-purple-400';
                  else if (ilvl >= 610) ilvlColor = 'text-blue-400';
                  return (
                    <div key={key} className="flex items-center gap-2 bg-base-300/50 rounded px-2 py-1.5 hover:bg-base-300 transition-colors">
                      <span className="text-xs text-base-content/40 w-10 shrink-0">{label}</span>
                      <span className={`text-xs font-bold ${ilvlColor}`}>{ilvl}</span>
                      {item.is_legendary && <span className="text-xs text-orange-400">★</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
