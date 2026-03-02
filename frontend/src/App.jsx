import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CharacterCard from './components/CharacterCard';
import { getCharacters, getSeasons, getCharactersBySeason } from './api';

export default function App() {
  const [characters, setCharacters] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null); // null = current (from DB)
  const [loading, setLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchCurrent = async () => {
    try {
      setError(null);
      const data = await getCharacters();
      setCharacters(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeason = async (seasonId) => {
    setSeasonLoading(true);
    setError(null);
    try {
      const data = await getCharactersBySeason(seasonId);
      setCharacters(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setSeasonLoading(false);
    }
  };

  useEffect(() => {
    // Load seasons list and current data in parallel
    Promise.all([
      getSeasons().then(setSeasons).catch(() => {}),
      fetchCurrent(),
    ]);
    const interval = setInterval(() => {
      if (!activeSeason) fetchCurrent();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSeasonChange = (season) => {
    setActiveSeason(season);
    if (season === null) {
      setLoading(true);
      fetchCurrent();
    } else {
      fetchSeason(season.id);
    }
  };

  const isLoadingAny = loading || seasonLoading;

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />

      {/* Hero section */}
      <div className="bg-gradient-to-b from-base-100 to-base-300 py-8 px-4 text-center">
        <h1 className="text-4xl font-title-cn text-primary mb-2">⚔️ 德阳小队</h1>
        <p className="text-base-content/60">Mythic+ 大秘境追踪 · 数据来源 Raider.IO</p>
        {lastUpdated && (
          <p className="text-xs text-base-content/40 mt-1">
            更新于 {lastUpdated.toLocaleTimeString('zh-CN')}
          </p>
        )}
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Season tabs */}
        {seasons.length > 0 && (
          <div className="tabs tabs-boxed bg-base-100 mb-6 flex-wrap gap-1 p-1">
            <button
              className={`tab ${activeSeason === null ? 'tab-active' : ''}`}
              onClick={() => handleSeasonChange(null)}
            >
              当前赛季
            </button>
            {seasons.map(s => (
              <button
                key={s.id}
                className={`tab ${activeSeason?.id === s.id ? 'tab-active' : ''}`}
                onClick={() => handleSeasonChange(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {isLoadingAny && (
          <div className="flex justify-center items-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <span className="ml-3 text-base-content/60">
              {seasonLoading ? '正在从 Raider.IO 拉取数据...' : '加载中...'}
            </span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4">
            <span>⚠️ {error}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => activeSeason ? fetchSeason(activeSeason.id) : fetchCurrent()}>重试</button>
          </div>
        )}

        {!isLoadingAny && !error && characters.length === 0 && (
          <div className="text-center py-20 text-base-content/50">
            <p className="text-5xl mb-4">🗡️</p>
            <p className="text-lg">还没有角色</p>
            <p className="text-sm mt-2">
              前往 <a href="/admin" className="link link-primary">管理页</a> 添加第一个角色
            </p>
          </div>
        )}

        {!isLoadingAny && characters.length > 0 && (
          <>
            {/* Stats summary */}
            <div className="stats stats-horizontal shadow w-full mb-6 bg-base-100">
              <div className="stat">
                <div className="stat-title">队员数量</div>
                <div className="stat-value text-primary">{characters.length}</div>
              </div>
              <div className="stat">
                <div className="stat-title">最高评分</div>
                <div className="stat-value text-secondary">{characters[0]?.score?.toFixed(0) || 0}</div>
              </div>
              <div className="stat">
                <div className="stat-title">平均评分</div>
                <div className="stat-value">
                  {(characters.reduce((s, c) => s + (c.score || 0), 0) / characters.length).toFixed(0)}
                </div>
              </div>
            </div>

            {activeSeason && (
              <div className="alert alert-info mb-4 py-2">
                <span className="text-sm">📜 正在查看历史赛季：<strong>{activeSeason.label}</strong></span>
              </div>
            )}

            {/* Character grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {characters.map((char, index) => (
                <CharacterCard key={char.id} character={char} rank={index + 1} season={activeSeason?.id} />
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="text-center py-6 text-base-content/30 text-xs">
        <p>deyangstats · 数据由 <a href="https://raider.io" target="_blank" rel="noopener noreferrer" className="link">Raider.IO</a> 提供</p>
      </footer>
    </div>
  );
}
