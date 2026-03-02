import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  return (
    <div className="navbar bg-base-100 shadow-lg border-b border-purple-900/40">
      <div className="container mx-auto">
        <div className="flex-1">
          <Link to="/" className="flex items-center gap-2 text-xl font-wow text-primary hover:text-primary-focus transition-colors">
            <span className="text-2xl">⚔️</span>
            <span>德阳 Stats</span>
          </Link>
        </div>
        <div className="flex-none gap-2">
          <Link
            to="/"
            className={`btn btn-sm btn-ghost ${location.pathname === '/' ? 'btn-active' : ''}`}
          >
            ⚔️ 魔兽世界
          </Link>
          <Link
            to="/marathon"
            className={`btn btn-sm btn-ghost ${location.pathname === '/marathon' ? 'btn-active' : ''}`}
          >
            🏃 马拉松
          </Link>
          <Link
            to="/valorant"
            className={`btn btn-sm btn-ghost ${location.pathname.startsWith('/valorant') ? 'btn-active' : ''}`}
          >
            🎯 Valorant
          </Link>
          <Link
            to="/admin"
            className={`btn btn-sm btn-ghost ${location.pathname === '/admin' ? 'btn-active' : ''}`}
          >
            ⚙️ 管理
          </Link>
        </div>
      </div>
    </div>
  );
}
