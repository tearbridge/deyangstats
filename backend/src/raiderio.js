const fetch = require('node-fetch');

const RAIDERIO_BASE = 'https://raider.io/api/v1';

/**
 * Fetch character profile from Raider.IO
 * @param {string} region - e.g. 'cn', 'us', 'eu'
 * @param {string} realm - e.g. '凤凰之神'
 * @param {string} name - character name
 */
const SEASONS = [
  { id: 'season-tww-3', label: 'TWW Season 3', current: true },
  { id: 'season-tww-2', label: 'TWW Season 2' },
  { id: 'season-tww-1', label: 'TWW Season 1' },
];

async function fetchCharacterProfile(region, realm, name, season = 'current') {
  const fields = [
    `mythic_plus_scores_by_season:${season}`,
    'mythic_plus_recent_runs',
    'mythic_plus_best_runs:all',
    'gear',
    'class',
    'active_spec_name',
    'thumbnail_url',
    'profile_url',
  ].join(',');

  const url = `${RAIDERIO_BASE}/characters/profile?region=${encodeURIComponent(region)}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=${encodeURIComponent(fields)}`;

  console.log(`[raiderio] Fetching: ${url}`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'deyangstats/1.0' },
    timeout: 15000,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Raider.IO API error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Extract current season M+ score from profile data
 */
function extractScore(profileData) {
  const scores = profileData.mythic_plus_scores_by_season;
  if (!scores || scores.length === 0) return 0;
  const current = scores[0];
  return current?.scores?.all || 0;
}

/**
 * Get the highest key level run this week from recent_runs
 */
function extractWeeklyBest(profileData) {
  const runs = profileData.mythic_plus_recent_runs || [];
  if (runs.length === 0) return null;

  const now = new Date();
  // WoW weekly reset: Tuesday 15:00 UTC for US, Wednesday 07:00 UTC for CN
  // Simple approach: look at runs from last 7 days
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weeklyRuns = runs.filter(r => new Date(r.completed_at) >= weekAgo);

  if (weeklyRuns.length === 0) return null;

  return weeklyRuns.reduce((best, run) => {
    return run.mythic_level > (best?.mythic_level || 0) ? run : best;
  }, null);
}

module.exports = { fetchCharacterProfile, extractScore, extractWeeklyBest, SEASONS };
