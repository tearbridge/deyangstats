const HENRIK_BASE = 'https://api.henrikdev.xyz';

function henrikHeaders() {
  const h = { 'User-Agent': 'deyangstats/1.0' };
  if (process.env.HENRIK_API_KEY) h['Authorization'] = process.env.HENRIK_API_KEY;
  return h;
}

async function fetchPlayerMMR(region, riotId, tagline) {
  const url = `${HENRIK_BASE}/valorant/v2/mmr/${region}/${encodeURIComponent(riotId)}/${encodeURIComponent(tagline)}`;
  const res = await fetch(url, {
    headers: henrikHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Henrik API error ${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 200) throw new Error(json.message || 'Henrik API error');
  return json.data;
}

async function fetchPlayerMatches(region, riotId, tagline, size = 5) {
  const url = `${HENRIK_BASE}/valorant/v3/matches/${region}/${encodeURIComponent(riotId)}/${encodeURIComponent(tagline)}?size=${size}`;
  const res = await fetch(url, {
    headers: henrikHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Henrik API error ${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 200) throw new Error(json.message || 'Henrik API error');
  return json.data || [];
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

module.exports = { fetchPlayerMMR, fetchPlayerMatches, tierToElo };
