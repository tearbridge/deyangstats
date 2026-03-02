const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

async function generateMonthlySummary(runnerName, runs) {
  const totalDistance = runs.reduce((s, r) => s + (r.distance || 0), 0) / 1000;
  const totalRuns = runs.length;
  const avgPace = runs.length > 0
    ? runs.reduce((s, r) => s + (r.pace || 0), 0) / runs.length
    : 0;

  const formatPace = (secPerMeter) => {
    if (!secPerMeter) return '未知';
    const secPerKm = secPerMeter * 1000;
    const min = Math.floor(secPerKm / 60);
    const sec = Math.round(secPerKm % 60);
    return `${min}:${sec.toString().padStart(2, '0')}/km`;
  };

  const runsText = runs.map(r =>
    `- ${r.date?.split('T')[0]} ${r.name || '跑步'}: ${(r.distance/1000).toFixed(2)}km，配速 ${formatPace(r.pace)}，用时 ${Math.floor(r.moving_time/60)}分钟`
  ).join('\n');

  const prompt = `你是一位专业的跑步教练。请根据以下训练数据，为跑者"${runnerName}"生成一份简洁的月度训练总结（200字左右，中文）。

本月训练数据：
- 总跑量：${totalDistance.toFixed(2)} km
- 训练次数：${totalRuns} 次
- 平均配速：${formatPace(avgPace)}

详细记录：
${runsText || '本月暂无训练记录'}

请包含：1) 本月训练量评价 2) 配速趋势分析 3) 针对马拉松备战的建议。语气专业但友好，像教练点评一样。`;

  const message = await client.chat.completions.create({
    model: 'moonshot-v1-8k',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.choices[0].message.content;
}

module.exports = { generateMonthlySummary };
