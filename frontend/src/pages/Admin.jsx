import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getCharacters, addCharacter, deleteCharacter, refreshCharacter } from '../api';

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '');
  const [tokenInput, setTokenInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // New character form
  const [form, setForm] = useState({ name: '', realm: '凤凰之神', region: 'cn' });
  const [adding, setAdding] = useState(false);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadCharacters = async () => {
    setLoading(true);
    try {
      setCharacters(await getCharacters());
    } catch (err) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    // Try to verify by doing a test request
    try {
      await addCharacter('__test__', '__test__', 'cn', tokenInput);
    } catch (err) {
      if (err.message === 'Unauthorized') {
        showMsg('Token 错误', 'error');
        return;
      }
      // Any other error means auth passed (e.g. validation error)
    }
    localStorage.setItem('adminToken', tokenInput);
    setToken(tokenInput);
    setAuthenticated(true);
    loadCharacters();
  };

  useEffect(() => {
    if (token) {
      setAuthenticated(true);
      loadCharacters();
    }
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.realm.trim()) return;
    setAdding(true);
    try {
      await addCharacter(form.name.trim(), form.realm.trim(), form.region, token);
      showMsg(`已添加 ${form.name}，正在后台拉取数据...`);
      setForm(f => ({ ...f, name: '' }));
      setTimeout(loadCharacters, 3000);
    } catch (err) {
      showMsg(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (char) => {
    if (!confirm(`确认删除 ${char.name}@${char.realm}？`)) return;
    try {
      await deleteCharacter(char.id, token);
      showMsg(`已删除 ${char.name}`);
      loadCharacters();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleRefresh = async (char) => {
    try {
      await refreshCharacter(char.id, token);
      showMsg(`已刷新 ${char.name}`);
      setTimeout(loadCharacters, 2000);
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-base-300">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-wow text-primary mb-6">⚙️ 管理面板</h1>

        {message && (
          <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'} mb-4`}>
            <span>{message.text}</span>
          </div>
        )}

        {!authenticated ? (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">🔐 管理员验证</h2>
              <div className="form-control">
                <label className="label"><span className="label-text">Admin Token</span></label>
                <input
                  type="password"
                  className="input input-bordered"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="输入 admin token..."
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                />
              </div>
              <div className="card-actions mt-2">
                <button className="btn btn-primary" onClick={handleAuth} disabled={!tokenInput}>
                  验证
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Add character form */}
            <div className="card bg-base-100 shadow mb-6">
              <div className="card-body">
                <h2 className="card-title text-base font-wow">➕ 添加角色</h2>
                <form onSubmit={handleAdd} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-control">
                      <label className="label text-xs"><span className="label-text">角色名</span></label>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="角色名称"
                        required
                      />
                    </div>
                    <div className="form-control">
                      <label className="label text-xs"><span className="label-text">服务器</span></label>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={form.realm}
                        onChange={e => setForm(f => ({ ...f, realm: e.target.value }))}
                        placeholder="凤凰之神"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-control">
                    <label className="label text-xs"><span className="label-text">地区</span></label>
                    <select
                      className="select select-bordered select-sm"
                      value={form.region}
                      onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                    >
                      <option value="cn">CN（国服）</option>
                      <option value="us">US（美服）</option>
                      <option value="eu">EU（欧服）</option>
                      <option value="tw">TW（台服）</option>
                      <option value="kr">KR（韩服）</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
                    {adding ? <span className="loading loading-spinner loading-xs"></span> : '添加角色'}
                  </button>
                </form>
              </div>
            </div>

            {/* Character list */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="card-title text-base font-wow">👥 角色列表</h2>
                  <button className="btn btn-ghost btn-xs" onClick={loadCharacters}>
                    {loading ? <span className="loading loading-spinner loading-xs"></span> : '↻ 刷新'}
                  </button>
                </div>

                {characters.length === 0 ? (
                  <p className="text-base-content/50 text-sm">暂无角色</p>
                ) : (
                  <div className="space-y-2">
                    {characters.map(char => (
                      <div key={char.id} className="flex items-center justify-between p-2 rounded-lg bg-base-200 hover:bg-base-300 transition-colors">
                        <div>
                          <div className="font-semibold text-sm">{char.name}</div>
                          <div className="text-xs text-base-content/50">{char.realm} · {char.region} · 评分: {char.score?.toFixed(1) || '—'}</div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-xs btn-ghost"
                            onClick={() => handleRefresh(char)}
                            title="立即刷新数据"
                          >
                            ↻
                          </button>
                          <button
                            className="btn btn-xs btn-error btn-outline"
                            onClick={() => handleDelete(char)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
                className="btn btn-ghost btn-xs text-base-content/40"
                onClick={() => {
                  localStorage.removeItem('adminToken');
                  setToken('');
                  setAuthenticated(false);
                }}
              >
                退出登录
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
