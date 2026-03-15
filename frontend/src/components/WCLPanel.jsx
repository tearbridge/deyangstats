import { useState } from 'react';

const CLASS_COLORS = {
  DeathKnight: '#C41E3A',
  DemonHunter: '#A330C9',
  Druid: '#FF7C0A',
  Evoker: '#33937F',
  Hunter: '#AAD372',
  Mage: '#3FC7EB',
  Monk: '#00FF98',
  Paladin: '#F48CBA',
  Priest: '#FFFFFF',
  Rogue: '#FFF468',
  Shaman: '#0070DD',
  Warlock: '#8788EE',
  Warrior: '#C69B3A',
};

function getClassColor(cls) {
  return CLASS_COLORS[cls] || '#aaa';
}

export default function WCLPanel() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const extractCode = (input) => {
    const match = input.match(/reports\/([a-zA-Z0-9]+)/);
    return match ? match[1] : input.trim();
  };

  const handleAnalyze = async () => {
    const reportCode = extractCode(code);
    if (!reportCode) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/wcl/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: reportCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '分析失败');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalDps = result?.players?.reduce((s, p) => s + p.dps, 0) || 1;

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <p className="text-sm text-base-content/60 mb-2">粘贴 WarcraftLogs 链接或 Report Code，AI 帮你分析今晚谁是拖累</p>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="https://www.warcraftlogs.com/reports/xxxxxx 或直接粘贴 Code"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            />
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={loading || !code.trim()}
            >
              {loading ? <span className="loading loading-spinner loading-sm" /> : '分析'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-base-content/50 text-sm">正在从 WarcraftLogs 拉取数据并分析，稍等...</p>
        </div>
      )}

      {result && (
        <>
          {/* Run overview */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-primary">
                {result.dungeon}
                <span className="badge badge-primary ml-2">+{result.keyLevel}</span>
                {result.timerBeat
                  ? <span className="badge badge-success ml-1">提前 {result.timerDiff}</span>
                  : <span className="badge badge-error ml-1">超时 {result.timerDiff}</span>
                }
              </h2>
              <div className="flex flex-wrap gap-4 text-sm text-base-content/70 mt-1">
                <span>⏱ 用时 {result.duration}</span>
                {result.avgIlvl && <span>🛡 平均装等 {result.avgIlvl}</span>}
                {result.affixes?.length > 0 && <span>🔱 {result.affixes.join(' · ')}</span>}
              </div>
            </div>
          </div>

          {/* Players */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="font-bold mb-3">⚔️ 队员输出</h3>
              <div className="space-y-3">
                {result.players
                  .sort((a, b) => b.dps - a.dps)
                  .map(player => {
                    const deathCount = result.deaths.filter(d => d.player === player.name).length;
                    const pct = Math.round((player.dps / totalDps) * 100);
                    return (
                      <div key={player.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: getClassColor(player.class) }}>
                              {player.name}
                            </span>
                            <span className="text-xs text-base-content/50">{player.spec}</span>
                            {deathCount > 0 && (
                              <span className="badge badge-error badge-xs">💀×{deathCount}</span>
                            )}
                          </div>
                          <div className="text-sm text-right">
                            {player.dps > 0 && <span className="text-error font-mono">{(player.dps/1000).toFixed(1)}k DPS</span>}
                            {player.hps > 0 && <span className="text-success font-mono ml-2">{(player.hps/1000).toFixed(1)}k HPS</span>}
                          </div>
                        </div>
                        {player.dps > 0 && (
                          <div className="w-full bg-base-300 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: getClassColor(player.class) }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Deaths */}
          {result.deaths.length > 0 && (
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h3 className="font-bold mb-3">💀 死亡记录</h3>
                <div className="space-y-1">
                  {result.deaths.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-base-content/40 font-mono w-12">{d.time}</span>
                      <span className="text-error font-medium">{d.player}</span>
                      <span className="text-base-content/60">被</span>
                      <span className="text-warning">[{d.ability}]</span>
                      <span className="text-base-content/60">击杀</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Analysis */}
          <div className="card bg-base-100 shadow border border-primary/30">
            <div className="card-body">
              <h3 className="font-bold mb-3 text-primary">🤖 AI 复盘点评</h3>
              <div className="text-sm leading-relaxed whitespace-pre-line text-base-content/90">
                {result.analysis}
              </div>
            </div>
          </div>

          <div className="text-center">
            <a
              href={`https://www.warcraftlogs.com/reports/${result.reportCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary text-sm"
            >
              在 WarcraftLogs 查看完整记录 →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
