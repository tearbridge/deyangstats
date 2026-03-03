require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const db = require('./db');
const { fetchCharacterProfile, extractScore, extractWeeklyBest, SEASONS } = require('./raiderio');
const { fetchRecentRuns, fetchWellness } = require('./intervals');
const { startScheduler, refreshCharacter } = require('./scheduler');
const { fetchPlayerMMR, fetchPlayerMatches, fetchPlayerAccount, fetchPlayerMMRHistory, tierToElo } = require('./valorant');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

app.use(cors());
app.use(express.json());

// Auth middleware for admin routes
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/characters — return all characters with latest snapshot data
app.get('/api/characters', (req, res) => {
  const characters = db.prepare('SELECT * FROM characters ORDER BY created_at ASC').all();

  const result = characters.map(char => {
    const latest = db.prepare(`
      SELECT * FROM snapshots
      WHERE character_id = ?
      ORDER BY fetched_at DESC
      LIMIT 1
    `).get(char.id);

    let parsedData = null;
    if (latest?.data) {
      try { parsedData = JSON.parse(latest.data); } catch {}
    }

    const weeklyBest = parsedData ? extractWeeklyBest(parsedData) : null;

    return {
      id: char.id,
      name: char.name,
      realm: char.realm,
      region: char.region,
      created_at: char.created_at,
      score: latest?.score || 0,
      fetched_at: latest?.fetched_at || null,
      class: parsedData?.class || null,
      active_spec_name: parsedData?.active_spec_name || null,
      thumbnail_url: parsedData?.thumbnail_url || null,
      profile_url: parsedData?.profile_url || null,
      weekly_best: weeklyBest ? {
        dungeon: weeklyBest.dungeon?.name,
        mythic_level: weeklyBest.mythic_level,
        score: weeklyBest.score,
        completed_at: weeklyBest.completed_at,
      } : null,
      scores_by_season: parsedData?.mythic_plus_scores_by_season?.[0]?.scores || null,
    };
  });

  // Sort by score descending
  result.sort((a, b) => b.score - a.score);

  res.json(result);
});

// GET /api/seasons — list available seasons
app.get('/api/seasons', (req, res) => {
  res.json(SEASONS);
});

// GET /api/characters/season/:season — fetch all characters for a specific season (live from Raider.IO)
app.get('/api/characters/season/:season', async (req, res) => {
  const { season } = req.params;
  const validSeason = SEASONS.find(s => s.id === season);
  if (!validSeason) {
    return res.status(400).json({ error: 'Invalid season' });
  }

  const characters = db.prepare('SELECT * FROM characters ORDER BY created_at ASC').all();

  const results = await Promise.all(characters.map(async char => {
    try {
      const data = await fetchCharacterProfile(char.region, char.realm, char.name, season);
      const score = data.mythic_plus_scores_by_season?.[0]?.scores?.all || 0;
      const weeklyBest = extractWeeklyBest(data);
      return {
        id: char.id,
        name: char.name,
        realm: char.realm,
        region: char.region,
        score,
        class: data.class || null,
        active_spec_name: data.active_spec_name || null,
        thumbnail_url: data.thumbnail_url || null,
        profile_url: data.profile_url || null,
        weekly_best: weeklyBest ? {
          dungeon: weeklyBest.dungeon?.name,
          mythic_level: weeklyBest.mythic_level,
          score: weeklyBest.score,
          completed_at: weeklyBest.completed_at,
        } : null,
        scores_by_season: data.mythic_plus_scores_by_season?.[0]?.scores || null,
      };
    } catch (err) {
      return {
        id: char.id,
        name: char.name,
        realm: char.realm,
        region: char.region,
        score: 0,
        error: err.message,
      };
    }
  }));

  results.sort((a, b) => b.score - a.score);
  res.json(results);
});

// POST /api/characters — add a character
app.post('/api/characters', requireAdmin, async (req, res) => {
  const { name, realm, region = 'cn' } = req.body;

  if (!name || !realm) {
    return res.status(400).json({ error: 'name and realm are required' });
  }

  // Check duplicate
  const existing = db.prepare(
    'SELECT id FROM characters WHERE LOWER(name) = LOWER(?) AND realm = ? AND region = ?'
  ).get(name, realm, region);

  if (existing) {
    return res.status(409).json({ error: 'Character already exists' });
  }

  const result = db.prepare(
    'INSERT INTO characters (name, realm, region) VALUES (?, ?, ?)'
  ).run(name, realm, region);

  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid);

  // Fetch data immediately in background
  refreshCharacter(char).catch(() => {});

  res.status(201).json(char);
});

// DELETE /api/characters/:id
app.delete('/api/characters/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
  if (!char) {
    return res.status(404).json({ error: 'Character not found' });
  }

  db.prepare('DELETE FROM snapshots WHERE character_id = ?').run(id);
  db.prepare('DELETE FROM characters WHERE id = ?').run(id);

  res.json({ success: true });
});

// GET /api/characters/:id/history — score history
app.get('/api/characters/:id/history', (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 24, 168); // max 1 week

  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
  if (!char) {
    return res.status(404).json({ error: 'Character not found' });
  }

  const history = db.prepare(`
    SELECT id, score, fetched_at
    FROM snapshots
    WHERE character_id = ?
    ORDER BY fetched_at DESC
    LIMIT ?
  `).all(id, limit);

  res.json({
    character: char,
    history: history.reverse(),
  });
});

// GET /api/characters/:id — single character with full data, optional ?season=
app.get('/api/characters/:id', async (req, res) => {
  const { id } = req.params;
  const { season } = req.query;

  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
  if (!char) {
    return res.status(404).json({ error: 'Character not found' });
  }

  // If season requested, fetch live from Raider.IO
  if (season) {
    const validSeason = SEASONS.find(s => s.id === season);
    if (!validSeason) return res.status(400).json({ error: 'Invalid season' });
    try {
      const data = await fetchCharacterProfile(char.region, char.realm, char.name, season);
      const score = data.mythic_plus_scores_by_season?.[0]?.scores?.all || 0;
      return res.json({ ...char, score, fetched_at: new Date().toISOString(), profile: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Default: return cached snapshot
  const latest = db.prepare(`
    SELECT * FROM snapshots
    WHERE character_id = ?
    ORDER BY fetched_at DESC
    LIMIT 1
  `).get(id);

  let parsedData = null;
  if (latest?.data) {
    try { parsedData = JSON.parse(latest.data); } catch {}
  }

  res.json({
    ...char,
    score: latest?.score || 0,
    fetched_at: latest?.fetched_at || null,
    profile: parsedData,
  });
});

// POST /api/characters/:id/refresh — manual refresh
app.post('/api/characters/:id/refresh', requireAdmin, async (req, res) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id);
  if (!char) return res.status(404).json({ error: 'Character not found' });

  try {
    await refreshCharacter(char);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runners — 返回所有跑者及其最新数据
app.get('/api/runners', async (req, res) => {
  const runners = db.prepare('SELECT * FROM runners ORDER BY created_at ASC').all();
  const results = await Promise.all(runners.map(async runner => {
    try {
      const [runs, wellness] = await Promise.all([
        fetchRecentRuns(runner.athlete_id, runner.api_key),
        fetchWellness(runner.athlete_id, runner.api_key),
      ]);

      // 本周跑量（周一开始）
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const weeklyRuns = runs.filter(r => new Date(r.start_date_local) >= monday);
      const weeklyDistance = weeklyRuns.reduce((s, r) => s + (r.distance || 0), 0);

      return {
        id: runner.id,
        name: runner.name,
        athlete_id: runner.athlete_id,
        recent_runs: runs.slice(0, 5).map(r => ({
          name: r.name,
          date: r.start_date_local,
          distance: r.distance,
          moving_time: r.moving_time,
          pace: r.moving_time && r.distance ? (r.moving_time / r.distance) : null,
          total_elevation_gain: r.total_elevation_gain,
        })),
        weekly_distance: weeklyDistance,
        ctl: wellness?.ctl || 0,
        atl: wellness?.atl || 0,
        tsb: wellness ? (wellness.ctl - wellness.atl) : 0,
      };
    } catch (err) {
      return { id: runner.id, name: runner.name, athlete_id: runner.athlete_id, error: err.message };
    }
  }));
  res.json(results);
});

// POST /api/runners — 添加跑者（admin）
app.post('/api/runners', requireAdmin, (req, res) => {
  const { name, athlete_id, api_key } = req.body;
  if (!name || !athlete_id || !api_key) return res.status(400).json({ error: 'name, athlete_id and api_key required' });
  const existing = db.prepare('SELECT id FROM runners WHERE athlete_id = ?').get(athlete_id);
  if (existing) return res.status(409).json({ error: 'Runner already exists' });
  const result = db.prepare('INSERT INTO runners (name, athlete_id, api_key) VALUES (?, ?, ?)').run(name, athlete_id, api_key);
  res.status(201).json(db.prepare('SELECT id, name, athlete_id, created_at FROM runners WHERE id = ?').get(result.lastInsertRowid));
});

// DELETE /api/runners/:id — 删除跑者（admin）
app.delete('/api/runners/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM runners WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/runners/:id/summary?month=2026-03 — 获取月度总结（有缓存直接返回）
app.get('/api/runners/:id/summary', async (req, res) => {
  const { id } = req.params;
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const runner = db.prepare('SELECT * FROM runners WHERE id = ?').get(id);
  if (!runner) return res.status(404).json({ error: 'Runner not found' });

  const cached = db.prepare('SELECT * FROM runner_summaries WHERE runner_id = ? AND month = ?').get(id, month);
  if (cached) return res.json({ summary: cached.summary, generated_at: cached.generated_at, cached: true });

  res.status(404).json({ error: 'No summary yet', month });
});

// POST /api/runners/:id/summary — 生成（或重新生成）月度总结
app.post('/api/runners/:id/summary', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const month = req.body.month || new Date().toISOString().slice(0, 7);

  const runner = db.prepare('SELECT * FROM runners WHERE id = ?').get(id);
  if (!runner) return res.status(404).json({ error: 'Runner not found' });

  try {
    const [year, mon] = month.split('-');
    const oldest = `${year}-${mon}-01`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const newest = `${year}-${mon}-${lastDay}`;

    const fetch = require('node-fetch');
    const url = `https://intervals.icu/api/v1/athlete/${runner.athlete_id}/activities?oldest=${oldest}&newest=${newest}&limit=100`;
    const apiRes = await fetch(url, {
      headers: { Authorization: 'Basic ' + Buffer.from(`API_KEY:${runner.api_key}`).toString('base64') }
    });
    const allActivities = await apiRes.json();
    const runs = allActivities
      .filter(a => a.type === 'Run')
      .map(r => ({
        name: r.name,
        date: r.start_date_local,
        distance: r.distance,
        moving_time: r.moving_time,
        total_elevation_gain: r.total_elevation_gain,
        pace: r.moving_time && r.distance ? (r.moving_time / r.distance) : null,
      }));

    const { generateMonthlySummary } = require('./summary');
    const summary = await generateMonthlySummary(runner.name, runs);

    db.prepare(`
      INSERT OR REPLACE INTO runner_summaries (runner_id, month, summary, generated_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(id, month, summary);

    res.json({ summary, generated_at: new Date().toISOString(), cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runners/:id/report-data?oldest=&newest= — 返回时间段内的训练+wellness原始数据
app.get('/api/runners/:id/report-data', async (req, res) => {
  const runner = db.prepare('SELECT * FROM runners WHERE id = ?').get(req.params.id);
  if (!runner) return res.status(404).json({ error: 'Runner not found' });

  const oldest = req.query.oldest || new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
  const newest = req.query.newest || new Date().toISOString().split('T')[0];

  try {
    const { fetchActivitiesRange, fetchWellnessRange } = require('./intervals');
    const [runs, wellness] = await Promise.all([
      fetchActivitiesRange(runner.athlete_id, runner.api_key, oldest, newest),
      fetchWellnessRange(runner.athlete_id, runner.api_key, oldest, newest),
    ]);
    res.json({ runs, wellness, oldest, newest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runners/:id/report — 生成AI报告（需admin）
app.post('/api/runners/:id/report', requireAdmin, async (req, res) => {
  const runner = db.prepare('SELECT * FROM runners WHERE id = ?').get(req.params.id);
  if (!runner) return res.status(404).json({ error: 'Runner not found' });

  const { oldest, newest, runs, wellness } = req.body;
  const dateRange = `${oldest} 至 ${newest}`;

  try {
    const { generateReport } = require('./summary');
    const report = await generateReport(runner.name, runs, wellness, dateRange);
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== VALORANT ROUTES =====

// Helper to refresh a val player's MMR snapshot
async function refreshValPlayer(player) {
  try {
    const data = await fetchPlayerMMR(player.region, player.riot_id, player.tagline);
    const tier = data.current_data?.currenttierpatched || 'Unrated';
    const rr = data.current_data?.ranking_in_tier || 0;
    const elo = tierToElo(tier, rr);
    db.prepare(`
      INSERT INTO val_snapshots (player_id, tier, rr, elo, fetched_at, data)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
    `).run(player.id, tier, rr, elo, JSON.stringify(data));
  } catch (err) {
    console.error(`[val] Failed to refresh ${player.riot_id}#${player.tagline}:`, err.message);
  }
}

// GET /api/val/players
app.get('/api/val/players', (req, res) => {
  const players = db.prepare('SELECT * FROM val_players ORDER BY created_at ASC').all();
  const result = players.map(p => {
    const latest = db.prepare(`
      SELECT * FROM val_snapshots WHERE player_id = ? ORDER BY fetched_at DESC LIMIT 1
    `).get(p.id);
    let parsedData = null;
    if (latest?.data) { try { parsedData = JSON.parse(latest.data); } catch {} }
    return {
      id: p.id,
      name: p.name,
      riot_id: p.riot_id,
      tagline: p.tagline,
      region: p.region,
      created_at: p.created_at,
      tier: latest?.tier || 'Unrated',
      rr: latest?.rr || 0,
      elo: latest?.elo || 0,
      fetched_at: latest?.fetched_at || null,
      peak: parsedData?.highest_rank?.patched_tier || null,
    };
  });
  result.sort((a, b) => b.elo - a.elo);
  res.json(result);
});

// POST /api/val/players
app.post('/api/val/players', requireAdmin, async (req, res) => {
  const { name, riot_id, tagline, region = 'ap' } = req.body;
  if (!name || !riot_id || !tagline) {
    return res.status(400).json({ error: 'name, riot_id and tagline are required' });
  }
  const existing = db.prepare(
    'SELECT id FROM val_players WHERE LOWER(riot_id) = LOWER(?) AND LOWER(tagline) = LOWER(?)'
  ).get(riot_id, tagline);
  if (existing) return res.status(409).json({ error: 'Player already exists' });

  const result = db.prepare(
    'INSERT INTO val_players (name, riot_id, tagline, region) VALUES (?, ?, ?, ?)'
  ).run(name, riot_id, tagline, region);
  const player = db.prepare('SELECT * FROM val_players WHERE id = ?').get(result.lastInsertRowid);
  refreshValPlayer(player).catch(() => {});
  res.status(201).json(player);
});

// DELETE /api/val/players/:id
app.delete('/api/val/players/:id', requireAdmin, (req, res) => {
  const player = db.prepare('SELECT * FROM val_players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  db.prepare('DELETE FROM val_snapshots WHERE player_id = ?').run(req.params.id);
  db.prepare('DELETE FROM val_players WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/val/players/:id
app.get('/api/val/players/:id', async (req, res) => {
  const player = db.prepare('SELECT * FROM val_players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const latest = db.prepare(`
    SELECT * FROM val_snapshots WHERE player_id = ? ORDER BY fetched_at DESC LIMIT 1
  `).get(player.id);
  let parsedData = null;
  if (latest?.data) { try { parsedData = JSON.parse(latest.data); } catch {} }

  // Parallel fetch: matches + account info + MMR history
  let matches = [];
  let account = null;
  let mmr_history_recent = [];

  await Promise.allSettled([
    fetchPlayerMatches(player.region, player.riot_id, player.tagline, 5).then(raw => {
      matches = raw.map(m => {
        const me = m.players?.all_players?.find(p =>
          p.name?.toLowerCase() === player.riot_id.toLowerCase() &&
          p.tag?.toLowerCase() === player.tagline.toLowerCase()
        );

        // Headshot %
        const hs = me?.stats?.headshots || 0;
        const bs = me?.stats?.bodyshots || 0;
        const ls = me?.stats?.legshots || 0;
        const total_shots = hs + bs + ls;
        const hs_pct = total_shots > 0 ? Math.round(hs / total_shots * 100) : null;

        // Plants & defuses from round data
        let plants = 0, defuses = 0;
        if (Array.isArray(m.rounds)) {
          for (const round of m.rounds) {
            if (round.plant_events?.planted_by?.puuid && me?.puuid &&
                round.plant_events.planted_by.puuid === me.puuid) plants++;
            if (round.defuse_events?.defused_by?.puuid && me?.puuid &&
                round.defuse_events.defused_by.puuid === me.puuid) defuses++;
          }
        }

        // Team MVP (highest score on own team)
        const myTeam = me?.team?.toLowerCase();
        const teamPlayers = m.players?.all_players?.filter(p => p.team?.toLowerCase() === myTeam) || [];
        const topScore = Math.max(...teamPlayers.map(p => p.stats?.score || 0));
        const mvp = me && topScore > 0 && (me.stats?.score || 0) >= topScore;

        // Win/loss
        const won = me?.team
          ? (m.teams?.[me.team.toLowerCase()]?.has_won ?? null)
          : null;

        return {
          map: m.metadata?.map,
          mode: m.metadata?.mode,
          date: m.metadata?.game_start_patched,
          won,
          agent: me?.character,
          kills: me?.stats?.kills,
          deaths: me?.stats?.deaths,
          assists: me?.stats?.assists,
          score: me?.stats?.score,
          headshots: hs,
          bodyshots: bs,
          legshots: ls,
          hs_pct,
          damage_made: me?.damage_made ?? null,
          plants,
          defuses,
          mvp: mvp || false,
        };
      });
    }).catch(err => console.error('[val] match fetch error:', err.message)),

    fetchPlayerAccount(player.riot_id, player.tagline).then(data => {
      account = {
        level: data.account_level,
        card: data.card,
        last_update: data.last_update,
      };
    }).catch(err => console.error('[val] account fetch error:', err.message)),

    fetchPlayerMMRHistory(player.region, player.riot_id, player.tagline, 10).then(data => {
      mmr_history_recent = data.map(h => ({
        tier: h.currenttierpatched,
        rr: h.ranking_in_tier,
        change: h.mmr_change_to_last_game,
        map: h.map?.name || h.map,
        date: h.date_raw,
      }));
    }).catch(err => console.error('[val] mmr-history fetch error:', err.message)),
  ]);

  res.json({
    ...player,
    tier: latest?.tier || 'Unrated',
    rr: latest?.rr || 0,
    elo: latest?.elo || 0,
    fetched_at: latest?.fetched_at || null,
    peak: parsedData?.highest_rank?.patched_tier || null,
    mmr_history: parsedData?.by_season || null,
    account,
    mmr_history_recent,
    matches,
  });
});

// POST /api/val/players/:id/refresh
app.post('/api/val/players/:id/refresh', requireAdmin, async (req, res) => {
  const player = db.prepare('SELECT * FROM val_players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  try {
    await refreshValPlayer(player);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proxy/val-card?url=... — proxy Valorant player card images
app.get('/api/proxy/val-card', async (req, res) => {
  const { url } = req.query;
  if (!url || !(url.startsWith('https://media.valorant-api.com') || url.startsWith('https://assets.henrikdev.xyz'))) {
    return res.status(400).json({ error: 'Invalid url' });
  }
  try {
    const imgRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; deyangstats/1.0)' }
    });
    if (!imgRes.ok) return res.status(imgRes.status).end();
    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.set('Content-Type', imgRes.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) {
    console.error('[proxy/val-card]', err.message);
    res.status(500).end();
  }
});

// GET /api/proxy/avatar?url=... — proxy WoW avatar images
app.get('/api/proxy/avatar', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('https://render.worldofwarcraft.com')) {
    return res.status(400).json({ error: 'Invalid url' });
  }
  try {
    const imgRes = await fetch(url, {
      headers: {
        'Referer': 'https://raider.io/',
        'User-Agent': 'Mozilla/5.0 (compatible; deyangstats/1.0)',
      }
    });
    if (!imgRes.ok) return res.status(imgRes.status).end();
    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) {
    res.status(500).end();
  }
});

app.listen(PORT, () => {
  console.log(`[server] deyangstats backend running on port ${PORT}`);
  startScheduler();
});

module.exports = app;
