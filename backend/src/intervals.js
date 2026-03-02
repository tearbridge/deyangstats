const fetch = require('node-fetch');
const BASE = 'https://intervals.icu/api/v1';

// 获取最近活动（只取跑步）
async function fetchRecentRuns(athleteId, apiKey, days = 14) {
  const oldest = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  const newest = new Date().toISOString().split('T')[0];
  const url = `${BASE}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}&limit=20`;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64') }
  });
  if (!res.ok) throw new Error(`intervals.icu error ${res.status}`);
  const data = await res.json();
  return data.filter(a => a.type === 'Run');
}

// 获取 wellness 数据（CTL/ATL/TSB）
async function fetchWellness(athleteId, apiKey) {
  const oldest = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
  const newest = new Date().toISOString().split('T')[0];
  const url = `${BASE}/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64') }
  });
  if (!res.ok) throw new Error(`intervals.icu wellness error ${res.status}`);
  const data = await res.json();
  return data[data.length - 1] || null; // 最新一天
}

async function fetchActivitiesRange(athleteId, apiKey, oldest, newest) {
  const url = `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}&limit=200`;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64') }
  });
  if (!res.ok) throw new Error(`intervals.icu error ${res.status}`);
  const data = await res.json();
  return data.filter(a => a.type === 'Run').map(r => ({
    id: r.id,
    name: r.name,
    date: r.start_date_local?.split('T')[0],
    distance: r.distance || 0,
    moving_time: r.moving_time || 0,
    pace: r.moving_time && r.distance ? r.moving_time / r.distance : null,
    average_heartrate: r.average_heartrate || null,
    max_heartrate: r.max_heartrate || null,
    training_load: r.icu_training_load || null,
    total_elevation_gain: r.total_elevation_gain || 0,
    average_cadence: r.average_cadence || null,
  }));
}

async function fetchWellnessRange(athleteId, apiKey, oldest, newest) {
  const url = `https://intervals.icu/api/v1/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64') }
  });
  if (!res.ok) throw new Error(`intervals.icu wellness error ${res.status}`);
  return (await res.json()).map(w => ({
    date: w.id,
    ctl: w.ctl || null,
    atl: w.atl || null,
    tsb: w.ctl && w.atl ? w.ctl - w.atl : null,
    resting_hr: w.restingHR || null,
    hrv: w.hrv || null,
    sleep_secs: w.sleepSecs || null,
    sleep_score: w.sleepScore || null,
    weight: w.weight || null,
  }));
}

module.exports = { fetchRecentRuns, fetchWellness, fetchActivitiesRange, fetchWellnessRange };
