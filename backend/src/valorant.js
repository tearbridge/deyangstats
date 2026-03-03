const HENRIK_BASE = 'https://api.henrikdev.xyz';

function henrikHeaders() {
  const h = { 'User-Agent': 'deyangstats/1.0' };
  if (process.env.HENRIK_API_KEY) h['Authorization'] = process.env.HENRIK_API_KEY;
  return h;
}

async function henrikGet(url) {
  const res = await fetch(url, { headers: henrikHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.errors?.[0]?.message || body.message || `Henrik API error ${res.status}`;
    throw new Error(msg);
  }
  const json = await res.json();
  if (json.status !== 200) {
    const msg = json.errors?.[0]?.message || json.message || 'Henrik API error';
    throw new Error(msg);
  }
  return json.data;
}

async function fetchPlayerMMR(region, riotId, tagline) {
  const url = `${HENRIK_BASE}/valorant/v2/mmr/${region}/${encodeURIComponent(riotId)}/${encodeURIComponent(tagline)}`;
  return henrikGet(url);
}

async function fetchPlayerMatches(region, riotId, tagline, size = 5) {
  const url = `${HENRIK_BASE}/valorant/v3/matches/${region}/${encodeURIComponent(riotId)}/${encodeURIComponent(tagline)}?size=${size}`;
  return henrikGet(url) || [];
}

async function fetchPlayerAccount(riotId, tagline) {
  const url = `${HENRIK_BASE}/valorant/v1/account/${encodeURIComponent(riotId)}/${encodeURIComponent(tagline)}`;
  return henrikGet(url);
}

async function fetchPlayerMMRHistory(region, riotId, tagline, size = 10) {
  const url = `${HENRIK_BASE}/valorant/v1/mmr-history/${region}/${encodeURIComponent(riotId)}/${encodeURIComponent(tagline)}`;
  const data = await henrikGet(url);
  return (Array.isArray(data) ? data : []).slice(0, size);
}

const TIER_ORDER = [
  'Unrated', 'Iron 1', 'Iron 2', 'Iron 3',
  'Bronze 1', 'Bronze 2', 'Bronze 3',
  'Silver 1', 'Silver 2', 'Silver 3',
  'Gold 1', 'Gold 2', 'Gold 3',
  'Platinum 1', 'Platinum 2', 'Platinum 3',
  'Diamond 1', 'Diamond 2', 'Diamond 3',
  'Ascendant 1', 'Ascendant 2', 'Ascendant 3',
  'Immortal 1', 'Immortal 2', 'Immortal 3',
  'Radiant',
];

function tierToElo(tier, rr = 0) {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx < 0) return rr;
  return idx * 100 + (rr || 0);
}

module.exports = { fetchPlayerMMR, fetchPlayerMatches, fetchPlayerAccount, fetchPlayerMMRHistory, tierToElo };
