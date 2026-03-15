const fetch = require('node-fetch');
const OpenAI = require('openai');

// M+ affix ID → name (common ones)
const AFFIX_NAMES = {
  2: '激励', 3: '爆炸', 4: '无敌', 6: '加固', 7: '势不可当',
  8: '厄运', 9: '击穿', 10: '迷宫', 11: '憎怒', 12: '击退',
  13: '爆炸', 14: '吸血鬼', 120: '腐坏', 121: '活化', 122: '灵魂连接',
  123: '腐化', 124: '风暴', 128: '地震', 129: '风卷', 130: '磁场',
  131: '冰封', 132: '虚空', 133: '灼热', 134: '腐化', 135: '火焰',
  136: '风行', 137: '激励', 138: '磁暴', 139: '坚韧', 140: '暴烈',
};

const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const API_URL = 'https://www.warcraftlogs.com/api/v2/client';

// Token cache
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const credentials = Buffer.from(
    `${process.env.WCL_CLIENT_ID}:${process.env.WCL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`WCL auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function gqlQuery(gql, variables = {}) {
  const token = await getAccessToken();
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) throw new Error(`WCL API error: ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors.map(e => e.message).join(', '));
  return data.data;
}

// Fetch all data needed for analysis
async function fetchReportData(code) {
  // Step 1: Get report overview + fights + players
  const overviewQuery = `
    query($code: String!) {
      reportData {
        report(code: $code) {
          title
          startTime
          endTime
          region { slug }
          fights(killType: Kills) {
            id
            name
            startTime
            endTime
            kill
            keystoneLevel
            keystoneTime
            keystoneAffixes
            averageItemLevel
          }
          masterData {
            actors(type: "Player") {
              id
              name
              subType
              server
            }
          }
        }
      }
    }
  `;

  const overview = await gqlQuery(overviewQuery, { code });
  const report = overview.reportData.report;

  // Find the M+ dungeon fight (has keystoneLevel)
  const keystoneFight = report.fights.find(f => f.keystoneLevel);
  if (!keystoneFight) {
    throw new Error('未找到大秘境记录（只支持大秘境日志）');
  }

  const reportStart = report.startTime;
  const relStart = keystoneFight.startTime - reportStart;
  const relEnd = keystoneFight.endTime - reportStart;

  // Step 2: Get DPS + HPS tables
  const tableQuery = `
    query($code: String!, $fightIDs: [Int], $startTime: Float!, $endTime: Float!) {
      reportData {
        report(code: $code) {
          dpsTable: table(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime, dataType: DamageDone)
          healTable: table(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime, dataType: Healing)
        }
      }
    }
  `;

  const tables = await gqlQuery(tableQuery, {
    code,
    fightIDs: [keystoneFight.id],
    startTime: relStart,
    endTime: relEnd,
  });

  // Step 3: Get death events
  const deathQuery = `
    query($code: String!, $fightIDs: [Int], $startTime: Float!, $endTime: Float!) {
      reportData {
        report(code: $code) {
          events(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime, dataType: Deaths) {
            data
          }
        }
      }
    }
  `;

  const deathData = await gqlQuery(deathQuery, {
    code,
    fightIDs: [keystoneFight.id],
    startTime: relStart,
    endTime: relEnd,
  });

  // Build actor name map
  const actorMap = {};
  for (const actor of report.masterData.actors) {
    actorMap[actor.id] = actor;
  }

  // Debug: log raw table structure
  console.log('[wcl] dpsTable raw:', JSON.stringify(tables.reportData.report.dpsTable)?.slice(0, 500));
  console.log('[wcl] healTable raw:', JSON.stringify(tables.reportData.report.healTable)?.slice(0, 200));

  // Parse DPS data
  const dpsEntries = tables.reportData.report.dpsTable?.entries || [];
  const healEntries = tables.reportData.report.healTable?.entries || [];

  const duration = (keystoneFight.endTime - keystoneFight.startTime) / 1000; // seconds

  const players = dpsEntries.map(entry => {
    const healer = healEntries.find(h => h.id === entry.id);
    return {
      name: entry.name,
      class: entry.type,
      spec: entry.spec,
      dps: Math.round((entry.total || 0) / duration),
      hps: healer ? Math.round((healer.total || 0) / duration) : 0,
      totalDamage: entry.total || 0,
    };
  });

  // Add healers not in DPS list
  for (const healer of healEntries) {
    if (!players.find(p => p.name === healer.name)) {
      players.push({
        name: healer.name,
        class: healer.type,
        spec: healer.spec,
        dps: 0,
        hps: Math.round((healer.total || 0) / duration),
        totalDamage: 0,
      });
    }
  }

  // Parse deaths
  const rawDeaths = deathData.reportData.report.events?.data || [];
  const deaths = rawDeaths.map(d => {
    const victim = actorMap[d.targetID];
    const killer = d.ability;
    return {
      player: victim?.name || `Actor#${d.targetID}`,
      time: formatTime(d.timestamp - relStart),
      ability: killer?.name || '未知伤害',
    };
  });

  // Timer info
  const keystoneTime = keystoneFight.keystoneTime; // ms
  const actualTime = keystoneFight.endTime - keystoneFight.startTime; // ms
  const timerDiff = keystoneTime - actualTime; // positive = beat timer

  return {
    reportCode: code,
    title: report.title,
    dungeon: keystoneFight.name,
    keyLevel: keystoneFight.keystoneLevel,
    affixes: keystoneFight.keystoneAffixes?.map(id => AFFIX_NAMES[id] || `#${id}`) || [],
    avgIlvl: keystoneFight.averageItemLevel?.toFixed(0),
    duration: formatTime(actualTime),
    timerMs: keystoneTime,
    actualMs: actualTime,
    timerBeat: timerDiff > 0,
    timerDiff: formatTimeDiff(Math.abs(timerDiff)),
    players,
    deaths,
  };
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatTimeDiff(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}秒`;
  return `${min}分${sec}秒`;
}

// AI analysis via Kimi
async function analyzeReport(reportData) {
  const kimi = new OpenAI({
    apiKey: process.env.KIMI_API_KEY,
    baseURL: 'https://api.moonshot.cn/v1',
  });

  const timerStr = reportData.timerBeat
    ? `✅ 提前 ${reportData.timerDiff} 完成`
    : `❌ 超时 ${reportData.timerDiff}`;

  const playersText = reportData.players
    .map(p => `  - ${p.name}（${p.class} ${p.spec}）：DPS ${(p.dps/1000).toFixed(1)}k / HPS ${(p.hps/1000).toFixed(1)}k`)
    .join('\n');

  const deathsText = reportData.deaths.length === 0
    ? '  全程无死亡 🏆'
    : reportData.deaths
        .map(d => `  - ${d.player} 在 ${d.time} 被 [${d.ability}] 击杀`)
        .join('\n');

  const prompt = `你是一个魔兽世界大秘境复盘助手，风格幽默毒舌但有建设性，像群友互相吐槽那种，说中文。

⚠️ 重要：点评时必须直接使用下面每个人的真实角色名，不能用"DPS最高的那个"这种描述，必须点名道姓。

本次大秘境数据：
副本：${reportData.dungeon}
钥石等级：+${reportData.keyLevel}
词缀：${reportData.affixes.join('、') || '无'}
用时：${reportData.duration}（${timerStr}）
平均装等：${reportData.avgIlvl || '未知'}

队员输出（按角色名列出）：
${playersText}

死亡记录：
${deathsText}

请从以下角度进行点评（每条必须点名）：
1. 谁是今晚最大的功臣 / 拖累（直接说名字，结合DPS和死亡情况）
2. timer的关键因素
3. 每个人一句点评（必须每人都有，写上名字，要有个性，不要千篇一律）
4. 一句话总结

语气像群友聊天，可以夸可以骂，但别太过分。200-300字即可。`;

  const response = await kimi.chat.completions.create({
    model: 'moonshot-v1-8k',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0].message.content;
}

module.exports = { fetchReportData, analyzeReport };
