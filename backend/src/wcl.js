const fetch = require('node-fetch');
const OpenAI = require('openai');

// M+ affix ID → 中文名（TWW赛季）
const AFFIX_NAMES = {
  // 核心词缀
  9:   '暴虐',      // Tyrannical
  10:  '强韧',      // Fortified
  // 萨拉塔斯系列
  147: '萨拉塔斯的诡计',      // Xal'atath's Guile
  148: '约定:飞升',           // Xal'atath's Bargain: Ascendant
  149: '约定:虚空缚',         // Xal'atath's Bargain: Voidbound
  150: '约定:虔诚',           // Xal'atath's Bargain: Devout
  151: '约定:湮灭',           // Xal'atath's Bargain: Oblivion
  // 经典词缀（部分仍在轮换）
  11:  '爆裂',      // Bursting
  12:  '悲伤',      // Grievous
  13:  '爆炸箱',    // Explosive
  14:  '颤动',      // Quaking
  6:   '加固',      // Reinforced (old)
  7:   '势不可当',  // Bolstering
  8:   '坚韧',      // Sanguine
  3:   '活化',      // Volcanic
  4:   '无敌',      // Spiteful
  2:   '神经',      // Skittish
  120: '腐坏',      // Corrupted
  121: '爆发',      // Infested
  122: '灵魂链接',  // Linked
  123: '腐化',      // Beguiling
  124: '风暴',      // Awakened
};

const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const API_URL = 'https://www.warcraftlogs.com/api/v2/client';

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

async function fetchReportData(code) {
  // Step 1: Overview + fights + actors
  const overview = await gqlQuery(`
    query($code: String!) {
      reportData {
        report(code: $code) {
          title
          startTime
          endTime
          fights(killType: Kills) {
            id name startTime endTime kill
            keystoneLevel keystoneTime keystoneAffixes averageItemLevel
          }
          masterData {
            actors(type: "Player") { id name subType server }
          }
        }
      }
    }
  `, { code });

  const report = overview.reportData.report;
  const keystoneFight = report.fights.find(f => f.keystoneLevel);
  if (!keystoneFight) throw new Error('未找到大秘境记录（只支持大秘境日志）');

  const relStart = keystoneFight.startTime;
  const relEnd = keystoneFight.endTime;
  const fightIDs = [keystoneFight.id];

  // Build actor map
  const actorMap = {};
  for (const actor of report.masterData.actors) actorMap[actor.id] = actor;

  // Step 2: DPS table + heal table + playerDetails + deaths (all in one query)
  const mainData = await gqlQuery(`
    query($code: String!, $fightIDs: [Int], $startTime: Float!, $endTime: Float!) {
      reportData {
        report(code: $code) {
          dpsTable: table(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime, dataType: DamageDone)
          healTable: table(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime, dataType: Healing)
          interruptTable: table(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime, dataType: Interrupts)
          playerDetails(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime)
          rankings(fightIDs: $fightIDs)
          deaths: events(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime, dataType: Deaths) { data }
        }
      }
    }
  `, { code, fightIDs, startTime: relStart, endTime: relEnd });

  const r = mainData.reportData.report;

  // Role/spec map + potion usage
  const roleMap = {};
  const potionMap = {};
  const pd = r.playerDetails?.data?.playerDetails || {};

  for (const p of [...(pd.tanks || []), ...(pd.healers || []), ...(pd.dps || [])]) {
    const role = pd.tanks?.find(x => x.name === p.name) ? 'Tank'
                : pd.healers?.find(x => x.name === p.name) ? 'Healer' : 'DPS';
    roleMap[p.name] = { role, spec: p.specs?.[0]?.spec || '' };
    potionMap[p.name] = p.potionUse || 0;
  }

  // Build rankings map: name → rankPercent
  // Structure: rankings.data[0].roles.{tanks,healers,dps}.characters[]
  const rankMap = {};
  const rankFight = (r.rankings?.data || [])[0];
  if (rankFight?.roles) {
    for (const group of Object.values(rankFight.roles)) {
      for (const p of (group.characters || [])) {
        if (p.name) rankMap[p.name] = p.rankPercent ?? null;
      }
    }
  }

  const dpsEntries = r.dpsTable?.data?.entries || [];
  const healEntries = r.healTable?.data?.entries || [];
  // interruptTable structure: data.entries[].entries[].details[] = {name, total}
  const interruptMap = {};
  for (const group of (r.interruptTable?.data?.entries || [])) {
    for (const spell of (group.entries || [])) {
      for (const player of (spell.details || [])) {
        interruptMap[player.name] = (interruptMap[player.name] || 0) + (player.total || 0);
      }
    }
  }
  const duration = (keystoneFight.endTime - keystoneFight.startTime) / 1000;

  // Build players with top 5 abilities
  const players = dpsEntries.map(entry => {
    const healer = healEntries.find(h => h.id === entry.id);
    const info = roleMap[entry.name] || {};
    const topAbilities = (entry.abilities || [])
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(a => ({ name: a.name, pct: Math.round((a.total / (entry.total || 1)) * 100) }));
    return {
      name: entry.name,
      class: entry.type,
      spec: info.spec || '',
      role: info.role || 'DPS',
      dps: Math.round((entry.total || 0) / duration),
      hps: healer ? Math.round((healer.total || 0) / duration) : 0,
      totalDamage: entry.total || 0,
      interrupts: interruptMap[entry.name] || 0,
      potionUse: potionMap[entry.name] || 0,
      rankPercent: rankMap[entry.name] ?? null,
      overhealPct: (info.role === 'Healer' || info.role === 'Tank') && healer && healer.total > 0
        ? Math.round(((healer.total - (healer.totalReduced || healer.total)) / healer.total) * 100)
        : null,
      topAbilities,
    };
  });

  // Add healer if not in DPS list
  for (const h of healEntries) {
    if (!players.find(p => p.name === h.name)) {
      const info = roleMap[h.name] || {};
      const topAbilities = (h.abilities || [])
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map(a => ({ name: a.name, pct: Math.round((a.total / (h.total || 1)) * 100) }));
      players.push({
        name: h.name, class: h.type, spec: info.spec || '', role: info.role || 'Healer',
        dps: 0, hps: Math.round((h.total || 0) / duration), totalDamage: 0,
        interrupts: interruptMap[h.name] || 0,
        potionUse: potionMap[h.name] || 0,
        rankPercent: rankMap[h.name] ?? null,
        overhealPct: h.total > 0
          ? Math.round(((h.total - (h.totalReduced || h.total)) / h.total) * 100)
          : null,
        topAbilities,
      });
    }
  }

  // Parse deaths
  const rawDeaths = r.deaths?.data || [];
  const deaths = rawDeaths.map(d => ({
    player: actorMap[d.targetID]?.name || `Actor#${d.targetID}`,
    targetID: d.targetID,
    timestamp: d.timestamp,
    time: formatTime(d.timestamp - relStart),
    ability: d.ability?.name || '未知伤害',
  }));

  // Step 3: For each death, query healing received in the 3s before
  if (deaths.length > 0) {
    await Promise.all(deaths.map(async (death) => {
      const windowStart = Math.max(relStart, death.timestamp - 3000);
      const windowEnd = death.timestamp;
      try {
        const healWindow = await gqlQuery(`
          query($code: String!, $fightIDs: [Int], $startTime: Float!, $endTime: Float!, $targetID: Int) {
            reportData {
              report(code: $code) {
                events(fightIDs: $fightIDs, startTime: $startTime, endTime: $endTime, dataType: Healing, targetID: $targetID) {
                  data
                }
              }
            }
          }
        `, { code, fightIDs, startTime: windowStart, endTime: windowEnd, targetID: death.targetID });

        const healEvents = healWindow.reportData.report.events?.data || [];
        const totalHealReceived = healEvents.reduce((s, e) => s + (e.amount || 0), 0);
        death.healReceivedPreDeath = totalHealReceived;
      } catch (e) {
        death.healReceivedPreDeath = null;
      }
      // Clean up internal fields
      delete death.targetID;
      delete death.timestamp;
    }));
  }

  const keystoneTime = keystoneFight.keystoneTime;
  const actualTime = keystoneFight.endTime - keystoneFight.startTime;
  const timerDiff = keystoneTime - actualTime;

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

async function analyzeReport(reportData) {
  const kimi = new OpenAI({
    apiKey: process.env.KIMI_API_KEY,
    baseURL: 'https://api.moonshot.cn/v1',
  });

  const timerStr = reportData.timerBeat
    ? `✅ 提前 ${reportData.timerDiff} 完成`
    : `❌ 超时 ${reportData.timerDiff}`;

  const playersText = reportData.players.map(p => {
    const dpsStr = p.dps > 0 ? `DPS ${(p.dps/1000).toFixed(1)}k` : '';
    const hpsStr = p.hps > 0 ? `HPS ${(p.hps/1000).toFixed(1)}k` : '';
    const rankStr = p.rankPercent != null ? `WCL百分位 ${p.rankPercent.toFixed(0)}分` : 'WCL百分位 未知';
    const intStr = `打断 ${p.interrupts} 次`;
    const potionStr = `用药 ${p.potionUse} 次`;
    const overhealStr = p.overhealPct != null ? `过量治疗 ${p.overhealPct}%` : '';
    const stats = [dpsStr, hpsStr, rankStr, intStr, potionStr, overhealStr].filter(Boolean).join(' / ');
    return `  - ${p.name}（${p.role} · ${p.class} ${p.spec}）：${stats}`;
  }).join('\n');

  const deathsText = reportData.deaths.length === 0
    ? '  全程无死亡 🏆'
    : reportData.deaths.map(d => {
        const healStr = d.healReceivedPreDeath != null
          ? `，死前3秒收到治疗：${(d.healReceivedPreDeath/1000).toFixed(0)}k`
          : '';
        return `  - ${d.player} 在 ${d.time} 被 [${d.ability}] 击杀${healStr}`;
      }).join('\n');

  const prompt = `你是"德阳小队"的战后复盘机器人，专门在打完大秘境之后当着所有人的面点评每个人的表现。你的语气像一个资深WoW老炮儿，说话直接、刻薄、不留情面，对表现差的人不会安慰，对表现好的人也不会过度夸赞。

语气要求：
- 像群聊里骂队友的老玩家，不是正式报告
- 不要用"继续保持"、"表现不错"这种废话
- 有话直说，该骂就骂，该夸就用具体数据夸
- 例：不要说"输出不错"，要说"就你这点血量压力，冰法才3M？这装等打这个层数有点说不过去吧"

你具备魔兽世界的专业知识，包括各职业专精当前版本强度、大秘境boss机制、可规避技能判断等。

【不同职责的评判标准，非常重要，不能搞混】
- DPS：主要看WCL百分位，这是和全服同职业同专精比较的结果。低于50分说明输出偏弱，低于25分是明显不及格，高于75分才算发挥好
- 坦克（Tank）：不要拿DPS跟输出职业比，那不是坦克的本职。重点看：拉怪节奏、死亡次数、是否有因为坦克问题导致全队出问题
- 奶妈（Healer）：不要因为DPS高就说奶妈分心，奶完还能打输出说明治疗压力不大是好事。重点看：有没有人因为没奶到而死、HPS是否足够、过量治疗率（过高说明无效奶，过低说明奶量紧张）
- 用药（所有人）：高层秘境不喝爆发药是说不过去的，用药0次要点名批评

【本次大秘境】
副本：${reportData.dungeon}  层数：+${reportData.keyLevel}  词缀：${reportData.affixes.join('、') || '无'}
用时：${reportData.duration}（${timerStr}）  平均装等：${reportData.avgIlvl || '未知'}

【队员数据】
${playersText}

【死亡记录】
${deathsText}

请按以下结构输出点评：

**MVP**
这把谁贡献最大，点名，说明理由

**背锅位**
这把谁最该反思，点名，说明理由。如果全员表现都不错就直接说没有背锅位

**死亡复盘**
分析每次死亡：这个技能该不该躲、死前3秒治疗量说明奶妈当时有没有在奶他、是站场还是减伤没开

**总结**
一句话，今晚这把怎么样

字数250-350字，语气真实不做作，可以说脏话。`;

  const response = await kimi.chat.completions.create({
    model: 'kimi-k2.5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0].message.content;
}

module.exports = { fetchReportData, analyzeReport };
