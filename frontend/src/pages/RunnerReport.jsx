import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import Navbar from '../components/Navbar';
import { getRunnerReportData, generateRunnerReport } from '../api';

const CHART_COLORS = {
  ctl: '#bd93f9',
  atl: '#ffb86c',
  tsb: '#50fa7b',
  distance: '#8be9fd',
  pace: '#ff79c6',
  heartrate: '#ff5555',
  sleep: '#6272a4',
  sleepScore: '#50fa7b',
};

const CHART_STYLE = {
  backgroundColor: 'transparent',
  fontSize: 11,
};

const AXIS_STYLE = { fill: '#a6adc8', fontSize: 11 };

function formatPaceTick(secPerMeter) {
  if (!secPerMeter) return '';
  const secPerKm = secPerMeter * 1000;
  return `${Math.floor(secPerKm/60)}:${Math.round(secPerKm%60).toString().padStart(2,'0')}`;
}

function formatPaceLabel(secPerMeter) {
  if (!secPerMeter) return '—';
  return formatPaceTick(secPerMeter) + '/km';
}

function getDateRange(preset) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const newest = fmt(now);

  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    return { oldest: fmt(d), newest };
  }
  if (preset === 'month') {
    const d = new Date(now);
    d.setDate(now.getDate() - 30);
    return { oldest: fmt(d), newest };
  }
  if (preset === '3months') {
    const d = new Date(now);
    d.setDate(now.getDate() - 90);
    return { oldest: fmt(d), newest };
  }
  return null;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-base-200 rounded-lg p-3 flex flex-col gap-0.5">
      <div className="text-xs text-base-content/50">{label}</div>
      <div className="text-lg font-bold text-base-content">{value}</div>
      {sub && <div className="text-xs text-base-content/40">{sub}</div>}
    </div>
  );
}

export default function RunnerReport() {
  const { id } = useParams();
  const navigate = useNavigate();

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];

  const [oldest, setOldest] = useState(monthAgo);
  const [newest, setNewest] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runnerName, setRunnerName] = useState('跑者');

  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('adminToken') || '');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setAiReport('');
    try {
      const result = await getRunnerReportData(id, oldest, newest);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Try to get runner name from localStorage or just load data
    loadData();
  }, []);

  const applyPreset = (preset) => {
    const range = getDateRange(preset);
    if (range) {
      setOldest(range.oldest);
      setNewest(range.newest);
    }
  };

  const handleGenerateAI = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateRunnerReport(id, oldest, newest, data.runs, data.wellness, adminToken);
      setAiReport(result.report);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Prepare chart data
  const distanceData = data?.runs?.map(r => ({
    date: r.date,
    km: parseFloat((r.distance / 1000).toFixed(2)),
  })) || [];

  const wellnessData = data?.wellness?.filter(w => w.ctl || w.atl || w.tsb).map(w => ({
    date: w.date,
    CTL: w.ctl ? parseFloat(w.ctl.toFixed(1)) : null,
    ATL: w.atl ? parseFloat(w.atl.toFixed(1)) : null,
    TSB: w.tsb ? parseFloat(w.tsb.toFixed(1)) : null,
  })) || [];

  const paceData = data?.runs?.filter(r => r.pace).map(r => ({
    date: r.date,
    pace: parseFloat(r.pace.toFixed(4)),
    name: r.name,
  })) || [];

  const hrData = data?.runs?.filter(r => r.average_heartrate).map(r => ({
    date: r.date,
    '平均心率': r.average_heartrate,
    '最高心率': r.max_heartrate,
    name: r.name,
  })) || [];

  const sleepData = data?.wellness?.filter(w => w.sleep_secs).map(w => ({
    date: w.date,
    '睡眠时长(h)': parseFloat((w.sleep_secs / 3600).toFixed(1)),
    '睡眠评分': w.sleep_score,
  })) || [];

  // Stats summary
  const totalKm = data ? (data.runs.reduce((s, r) => s + r.distance, 0) / 1000).toFixed(1) : '—';
  const totalRuns = data?.runs?.length || 0;
  const runsWithPace = data?.runs?.filter(r => r.pace) || [];
  const avgPaceVal = runsWithPace.length > 0
    ? runsWithPace.reduce((s, r) => s + r.pace, 0) / runsWithPace.length
    : null;
  const latestWellness = data?.wellness?.[data.wellness.length - 1];

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/marathon')}>← 返回</button>
          <h1 className="text-xl font-bold text-success">📊 训练分析报告</h1>
        </div>

        {/* Date range selector */}
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              <button className="btn btn-xs btn-outline" onClick={() => applyPreset('week')}>本周</button>
              <button className="btn btn-xs btn-outline" onClick={() => applyPreset('month')}>近30天</button>
              <button className="btn btn-xs btn-outline" onClick={() => applyPreset('3months')}>近3个月</button>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex items-center gap-2">
                <label className="text-xs text-base-content/50">开始</label>
                <input type="date" className="input input-sm input-bordered" value={oldest} onChange={e => setOldest(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-base-content/50">结束</label>
                <input type="date" className="input input-sm input-bordered" value={newest} onChange={e => setNewest(e.target.value)} />
              </div>
              <button className="btn btn-sm btn-success" onClick={loadData} disabled={loading}>
                {loading ? <span className="loading loading-spinner loading-xs"></span> : '加载数据'}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error mb-4"><span>⚠️ {error}</span></div>}

        {data && (
          <>
            {/* Stats summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="总跑量" value={`${totalKm} km`} sub={`共 ${totalRuns} 次`} />
              <StatCard label="平均配速" value={avgPaceVal ? formatPaceLabel(avgPaceVal) : '—'} />
              <StatCard label="体能 CTL" value={latestWellness?.ctl?.toFixed(1) || '—'} sub={`ATL ${latestWellness?.atl?.toFixed(1) || '—'}`} />
              <StatCard label="状态 TSB" value={latestWellness?.tsb ? (latestWellness.tsb > 0 ? '+' : '') + latestWellness.tsb.toFixed(1) : '—'} />
            </div>

            {/* Charts */}
            <div className="space-y-6">
              {/* Daily distance */}
              {distanceData.length > 0 && (
                <div className="card bg-base-100 shadow">
                  <div className="card-body p-4">
                    <h3 className="text-sm font-semibold text-base-content/70 mb-3">每日跑量 (km)</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={distanceData} style={CHART_STYLE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#44475a" />
                        <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={AXIS_STYLE} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#282a36', border: '1px solid #44475a', borderRadius: 6 }}
                          labelStyle={{ color: '#f8f8f2' }}
                          itemStyle={{ color: CHART_COLORS.distance }}
                          formatter={v => [`${v} km`, '跑量']}
                        />
                        <Bar dataKey="km" fill={CHART_COLORS.distance} radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Fitness (CTL/ATL/TSB) */}
              {wellnessData.length > 0 && (
                <div className="card bg-base-100 shadow">
                  <div className="card-body p-4">
                    <h3 className="text-sm font-semibold text-base-content/70 mb-3">体能状态 (CTL / ATL / TSB)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={wellnessData} style={CHART_STYLE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#44475a" />
                        <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={AXIS_STYLE} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#282a36', border: '1px solid #44475a', borderRadius: 6 }}
                          labelStyle={{ color: '#f8f8f2' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="CTL" stroke={CHART_COLORS.ctl} dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="ATL" stroke={CHART_COLORS.atl} dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="TSB" stroke={CHART_COLORS.tsb} dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Pace trend */}
              {paceData.length > 0 && (
                <div className="card bg-base-100 shadow">
                  <div className="card-body p-4">
                    <h3 className="text-sm font-semibold text-base-content/70 mb-3">配速趋势（值越小越快）</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={paceData} style={CHART_STYLE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#44475a" />
                        <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={AXIS_STYLE} tickFormatter={formatPaceTick} domain={['auto', 'auto']} reversed />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#282a36', border: '1px solid #44475a', borderRadius: 6 }}
                          labelStyle={{ color: '#f8f8f2' }}
                          formatter={(v, _, props) => [formatPaceLabel(v), props.payload?.name || '配速']}
                        />
                        <Line type="monotone" dataKey="pace" stroke={CHART_COLORS.pace} dot={{ r: 3, fill: CHART_COLORS.pace }} strokeWidth={2} name="配速" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Heart rate trend */}
              {hrData.length > 0 && (
                <div className="card bg-base-100 shadow">
                  <div className="card-body p-4">
                    <h3 className="text-sm font-semibold text-base-content/70 mb-3">心率趋势 (bpm)</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={hrData} style={CHART_STYLE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#44475a" />
                        <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={AXIS_STYLE} domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#282a36', border: '1px solid #44475a', borderRadius: 6 }}
                          labelStyle={{ color: '#f8f8f2' }}
                          formatter={(v, name) => [`${v} bpm`, name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="平均心率" stroke={CHART_COLORS.heartrate} dot={{ r: 3, fill: CHART_COLORS.heartrate }} strokeWidth={2} />
                        <Line type="monotone" dataKey="最高心率" stroke="#ff8585" dot={false} strokeWidth={1} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Sleep */}
              {sleepData.length > 0 && (
                <div className="card bg-base-100 shadow">
                  <div className="card-body p-4">
                    <h3 className="text-sm font-semibold text-base-content/70 mb-3">睡眠情况</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <ComposedChart data={sleepData} style={CHART_STYLE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#44475a" />
                        <XAxis dataKey="date" tick={AXIS_STYLE} tickFormatter={v => v.slice(5)} />
                        <YAxis yAxisId="left" tick={AXIS_STYLE} />
                        <YAxis yAxisId="right" orientation="right" tick={AXIS_STYLE} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#282a36', border: '1px solid #44475a', borderRadius: 6 }}
                          labelStyle={{ color: '#f8f8f2' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar yAxisId="left" dataKey="睡眠时长(h)" fill={CHART_COLORS.sleep} radius={[3,3,0,0]} />
                        <Line yAxisId="right" type="monotone" dataKey="睡眠评分" stroke={CHART_COLORS.sleepScore} dot={false} strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* AI Report */}
            <div className="card bg-base-100 shadow mt-6">
              <div className="card-body p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-base-content/70">🤖 AI 训练分析</h3>
                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      type="password"
                      className="input input-xs input-bordered w-32"
                      placeholder="Admin Token"
                      value={adminToken}
                      onChange={e => { setAdminToken(e.target.value); localStorage.setItem('adminToken', e.target.value); }}
                    />
                    <button
                      className="btn btn-xs btn-primary"
                      onClick={handleGenerateAI}
                      disabled={aiLoading || !adminToken}
                    >
                      {aiLoading ? 'Kimi 分析中...' : '生成 AI 分析报告'}
                    </button>
                  </div>
                </div>
                {aiLoading && (
                  <div className="flex items-center gap-2 text-sm text-base-content/50">
                    <span className="loading loading-spinner loading-sm"></span>
                    Kimi 分析中，请稍候...
                  </div>
                )}
                {aiError && <div className="text-xs text-error">⚠️ {aiError}</div>}
                {aiReport && !aiLoading && (
                  <div className="mt-2 p-3 rounded-lg bg-base-200 text-sm whitespace-pre-wrap leading-relaxed">
                    {aiReport}
                  </div>
                )}
                {!aiReport && !aiLoading && !adminToken && (
                  <div className="text-xs text-base-content/40">请输入 Admin Token 后生成 AI 分析报告</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
