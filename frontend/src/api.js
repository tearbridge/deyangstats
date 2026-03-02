const BASE = '/api';

export async function getSeasons() {
  const res = await fetch(`${BASE}/seasons`);
  if (!res.ok) throw new Error('Failed to fetch seasons');
  return res.json();
}

export async function getCharactersBySeason(season) {
  const res = await fetch(`${BASE}/characters/season/${season}`);
  if (!res.ok) throw new Error('Failed to fetch season data');
  return res.json();
}

export async function getCharacters() {
  const res = await fetch(`${BASE}/characters`);
  if (!res.ok) throw new Error('Failed to fetch characters');
  return res.json();
}

export async function getCharacter(id) {
  const res = await fetch(`${BASE}/characters/${id}`);
  if (!res.ok) throw new Error('Failed to fetch character');
  return res.json();
}

export async function getCharacterHistory(id) {
  const res = await fetch(`${BASE}/characters/${id}/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function addCharacter(name, realm, region, adminToken) {
  const res = await fetch(`${BASE}/characters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ name, realm, region }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add character');
  }
  return res.json();
}

export async function deleteCharacter(id, adminToken) {
  const res = await fetch(`${BASE}/characters/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': adminToken },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete character');
  }
  return res.json();
}

export async function getRunners() {
  const res = await fetch(`${BASE}/runners`);
  if (!res.ok) throw new Error('Failed to fetch runners');
  return res.json();
}

export async function addRunner(name, athlete_id, api_key, adminToken) {
  const res = await fetch(`${BASE}/runners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
    body: JSON.stringify({ name, athlete_id, api_key }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add runner');
  }
  return res.json();
}

export async function deleteRunner(id, adminToken) {
  const res = await fetch(`${BASE}/runners/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': adminToken },
  });
  if (!res.ok) throw new Error('Failed to delete runner');
  return res.json();
}

export async function refreshCharacter(id, adminToken) {
  const res = await fetch(`${BASE}/characters/${id}/refresh`, {
    method: 'POST',
    headers: { 'X-Admin-Token': adminToken },
  });
  if (!res.ok) throw new Error('Failed to refresh');
  return res.json();
}

export async function getRunnerReportData(id, oldest, newest) {
  const res = await fetch(`${BASE}/runners/${id}/report-data?oldest=${oldest}&newest=${newest}`);
  if (!res.ok) throw new Error('Failed to fetch report data');
  return res.json();
}

export async function generateRunnerReport(id, oldest, newest, runs, wellness, adminToken) {
  const res = await fetch(`${BASE}/runners/${id}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
    body: JSON.stringify({ oldest, newest, runs, wellness }),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to generate'); }
  return res.json();
}

export async function getRunnerSummary(id, month) {
  const res = await fetch(`${BASE}/runners/${id}/summary?month=${month}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function generateRunnerSummary(id, month, adminToken) {
  const res = await fetch(`${BASE}/runners/${id}/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
    body: JSON.stringify({ month }),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to generate'); }
  return res.json();
}

// ===== VALORANT =====
export async function getValPlayers() {
  const res = await fetch(`${BASE}/val/players`);
  if (!res.ok) throw new Error('Failed to fetch val players');
  return res.json();
}

export async function getValPlayer(id) {
  const res = await fetch(`${BASE}/val/players/${id}`);
  if (!res.ok) throw new Error('Failed to fetch val player');
  return res.json();
}

export async function addValPlayer(name, riot_id, tagline, region, adminToken) {
  const res = await fetch(`${BASE}/val/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
    body: JSON.stringify({ name, riot_id, tagline, region }),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to add'); }
  return res.json();
}

export async function deleteValPlayer(id, adminToken) {
  const res = await fetch(`${BASE}/val/players/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': adminToken },
  });
  if (!res.ok) throw new Error('Failed to delete val player');
  return res.json();
}

export async function refreshValPlayer(id, adminToken) {
  const res = await fetch(`${BASE}/val/players/${id}/refresh`, {
    method: 'POST',
    headers: { 'X-Admin-Token': adminToken },
  });
  if (!res.ok) throw new Error('Failed to refresh');
  return res.json();
}
