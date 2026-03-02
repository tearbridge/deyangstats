const cron = require('node-cron');
const db = require('./db');
const { fetchCharacterProfile, extractScore } = require('./raiderio');

async function refreshCharacter(character) {
  try {
    const data = await fetchCharacterProfile(character.region, character.realm, character.name);
    const score = extractScore(data);

    db.prepare(`
      INSERT INTO snapshots (character_id, score, data, fetched_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(character.id, score, JSON.stringify(data));

    console.log(`[scheduler] Updated ${character.name}@${character.realm}: score=${score}`);
  } catch (err) {
    console.error(`[scheduler] Failed to update ${character.name}@${character.realm}: ${err.message}`);
  }
}

async function refreshAll() {
  console.log('[scheduler] Starting refresh for all characters...');
  const characters = db.prepare('SELECT * FROM characters').all();

  for (const char of characters) {
    await refreshCharacter(char);
    // Small delay between requests to be polite to the API
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[scheduler] Done. Refreshed ${characters.length} characters.`);
}

function startScheduler() {
  // Run every hour at :00
  cron.schedule('0 * * * *', () => {
    refreshAll().catch(err => console.error('[scheduler] Unexpected error:', err));
  });

  console.log('[scheduler] Hourly refresh scheduled.');

  // Also run once on startup after a short delay
  setTimeout(() => {
    refreshAll().catch(err => console.error('[scheduler] Startup refresh error:', err));
  }, 5000);
}

module.exports = { startScheduler, refreshAll, refreshCharacter };
