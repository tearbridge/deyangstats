require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const db = require('./db');
const { fetchCharacterProfile, extractScore, extractWeeklyBest, SEASONS } = require('./raiderio');
const { fetchRecentRuns, fetchWellness } = require('./intervals');
const { startScheduler, refreshCharacter } = require('./scheduler');

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

app.listen(PORT, () => {
  console.log(`[server] deyangstats backend running on port ${PORT}`);
  startScheduler();
});

module.exports = app;
