const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

const formatPace = (secPerMeter) => {
  if (!secPerMeter) return '未知';
  const secPerKm = secPerMeter * 1000;
  return `${Math.floor(secPerKm/60)}:${Math.round(secPerKm%60).toString().padStart(2,'0')}/km`;
};

async function generateReport(runnerName, runs, wellness, dateRange) {
  const totalDistance = runs.reduce((s, r) => s + r.distance, 0) / 1000;
  const totalRuns = runs.length;
  const runsWithPace = runs.filter(r => r.pace);
  const avgPace = runsWithPace.length > 0
    ? runsWithPace.reduce((s, r) => s + r.pace, 0) / runsWithPace.length
    : 0;
  const runsWithHR = runs.filter(r => r.average_heartrate);
  const avgHR = runsWithHR.length > 0
    ? runsWithHR.reduce((s, r) => s + r.average_heartrate, 0) / runsWithHR.length
    : 0;
  const totalLoad = runs.reduce((s, r) => s + (r.training_load || 0), 0);

  const latestWellness = wellness[wellness.length - 1];
  const wellnessWithSleep = wellness.filter(w => w.sleep_secs);
  const avgSleep = wellnessWithSleep.length > 0
    ? wellnessWithSleep.reduce((s, w) => s + w.sleep_secs, 0) / wellnessWithSleep.length / 3600
    : 0;

  const runsText = runs.slice(0, 15).map(r =>
    `${r.date} ${r.name}: ${(r.distance/1000).toFixed(1)}km 配速${formatPace(r.pace)} 心率${r.average_heartrate||'—'}bpm 负荷${r.training_load||'—'}`
  ).join('\n');

  const prompt = `你是专业马拉松教练。请为跑者"${runnerName}"生成一份${dateRange}训练分析报告（300字左右，中文）。

统计数据：
- 总跑量：${totalDistance.toFixed(1)}km，共${totalRuns}次训练
- 平均配速：${formatPace(avgPace)}
- 平均心率：${avgHR ? avgHR.toFixed(0)+'bpm' : '无数据'}
- 总训练负荷：${totalLoad}
- 当前体能CTL：${latestWellness?.ctl?.toFixed(1) || '—'}，疲劳ATL：${latestWellness?.atl?.toFixed(1) || '—'}，状态TSB：${latestWellness?.tsb?.toFixed(1) || '—'}
- 平均睡眠：${avgSleep ? avgSleep.toFixed(1)+'小时' : '无数据'}

训练记录（部分）：
${runsText || '（无训练记录）'}

请分析：1)跑量和强度是否合理 2)配速和心率趋势 3)体能疲劳状态评估 4)睡眠恢复情况 5)针对马拉松的具体建议。语气专业友好。`;

  const message = await client.chat.completions.create({
    model: 'moonshot-v1-8k',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.choices[0].message.content;
}

// Keep old function for backward compatibility
async function generateMonthlySummary(runnerName, runs) {
  return generateReport(runnerName, runs, [], '本月');
}

module.exports = { generateMonthlySummary, generateReport };
