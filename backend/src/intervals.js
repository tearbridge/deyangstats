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

module.exports = { fetchRecentRuns, fetchWellness };
