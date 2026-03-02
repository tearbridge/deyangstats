require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const db = require('./db');
const { fetchCharacterProfile, extractScore, extractWeeklyBest, SEASONS } = require('./raiderio');
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

app.listen(PORT, () => {
  console.log(`[server] deyangstats backend running on port ${PORT}`);
  startScheduler();
});

module.exports = app;
