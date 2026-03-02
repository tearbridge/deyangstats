import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getRunners } from '../api';

const RACE_DATE = new Date('2026-03-29T08:00:00+08:00');

function formatPace(secPerMeter) {
  if (!secPerMeter) return '—';
  const secPerKm = secPerMeter * 1000;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}/km`;
}

function formatDistance(meters) {
  if (!meters) return '—';
  return (meters / 1000).toFixed(2) + ' km';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return dateStr.slice(0, 10);
}

function Countdown() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = RACE_DATE - now;
  if (diff <= 0) return <span className="text-success font-bold">比赛已开始！</span>;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex gap-4 justify-center flex-wrap">
      {[
        { v: days, l: '天' },
        { v: hours, l: '小时' },
        { v: mins, l: '分钟' },
        { v: secs, l: '秒' },
      ].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center">
          <div className="text-4xl font-bold text-success font-mono w-16 text-center">{String(v).padStart(2, '0')}</div>
          <div className="text-xs text-base-content/60 mt-1">{l}</div>
        </div>
      ))}
    </div>
  );
}

function TsbBadge({ tsb }) {
  const color = tsb > 0 ? 'badge-success' : tsb < -10 ? 'badge-error' : 'badge-warning';
  return <span className={`badge badge-sm ${color}`}>TSB {tsb > 0 ? '+' : ''}{tsb.toFixed(1)}</span>;
}

function RunnerCard({ runner }) {
  const [expanded, setExpanded] = useState(false);
  const lastRun = runner.recent_runs?.[0];

  return (
    <div
      className="card bg-base-100 shadow border border-base-200 cursor-pointer hover:border-success/40 transition-colors"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="card-body p-4">
        {runner.error ? (
          <div>
            <div className="font-bold text-lg">{runner.name}</div>
            <div className="text-error text-xs mt-1">⚠️ {runner.error}</div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-lg flex items-center gap-2">
                  🏃 {runner.name}
                  <span className="text-xs text-base-content/40 font-normal">点击展开</span>
                </div>
                <div className="text-success font-semibold text-sm mt-0.5">
                  本周跑量 {formatDistance(runner.weekly_distance)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <TsbBadge tsb={runner.tsb} />
                <div className="text-xs text-base-content/50">
                  CTL {runner.ctl?.toFixed(1)} / ATL {runner.atl?.toFixed(1)}
                </div>
              </div>
            </div>

            {lastRun && (
              <div className="mt-2 p-2 rounded-lg bg-base-200 text-sm">
                <div className="text-xs text-base-content/50 mb-1">最近训练</div>
                <div className="flex gap-3 flex-wrap">
                  <span className="font-medium">{lastRun.name || '跑步'}</span>
                  <span className="text-base-content/60">{formatDate(lastRun.date)}</span>
                  <span className="text-success">{formatDistance(lastRun.distance)}</span>
                  <span className="text-primary">{formatPace(lastRun.pace)}</span>
                  {lastRun.total_elevation_gain > 0 && (
                    <span className="text-base-content/50">↑{lastRun.total_elevation_gain}m</span>
                  )}
                </div>
              </div>
            )}

            {expanded && runner.recent_runs?.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-xs text-base-content/50 mb-2">最近 5 次训练</div>
                {runner.recent_runs.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded bg-base-200 text-xs flex-wrap">
                    <span className="text-base-content/50 w-16 flex-shrink-0">{formatDate(r.date)}</span>
                    <span className="flex-1 min-w-0 truncate font-medium">{r.name || '跑步'}</span>
                    <span className="text-success font-mono">{formatDistance(r.distance)}</span>
                    <span className="text-primary font-mono">{formatPace(r.pace)}</span>
                    {r.total_elevation_gain > 0 && (
                      <span className="text-base-content/50">↑{r.total_elevation_gain}m</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Marathon() {
  const [runners, setRunners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRunners()
      .then(data => {
        // 按本周跑量降序排序
        data.sort((a, b) => (b.weekly_distance || 0) - (a.weekly_distance || 0));
        setRunners(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 倒计时 */}
        <div className="card bg-base-100 shadow mb-8 border border-success/20">
          <div className="card-body text-center py-6">
            <div className="text-sm text-base-content/60 mb-1">🏅 石家庄马拉松 2026-03-29</div>
            <Countdown />
            <div className="text-xs text-base-content/40 mt-2">距离比赛还有</div>
          </div>
        </div>

        {/* 跑者列表 */}
        <h2 className="text-xl font-bold text-success mb-4">🏃 训练排行</h2>

        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-success"></span>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <span>加载失败：{error}</span>
          </div>
        )}

        {!loading && !error && runners.length === 0 && (
          <div className="card bg-base-100 shadow">
            <div className="card-body text-center text-base-content/50">
              <p>还没有跑者数据，请在管理面板添加跑者。</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {runners.map((runner, i) => (
            <div key={runner.id} className="flex gap-3 items-start">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-3 ${i === 0 ? 'bg-success text-success-content' : i === 1 ? 'bg-success/60 text-base-content' : i === 2 ? 'bg-success/40 text-base-content' : 'bg-base-200 text-base-content/60'}`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <RunnerCard runner={runner} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
