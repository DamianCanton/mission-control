import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useMissionStore } from '../store/useMissionStore';

const navItems = [
  { to: '/dashboard', label: '📊 Dashboard' },
  { to: '/livefeed',  label: '📡 Live Feed'  },
  { to: '/agents',    label: '🤖 Agents'     },
];

const Layout = () => {
  const connected  = useMissionStore(state => state.connected);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white font-sans">

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2 font-bold text-base">
          <span>⭐</span> Mission Control
        </div>
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              // X
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // ☰
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile nav drawer ───────────────────────────────────────────── */}
      {menuOpen && (
        <nav className="md:hidden bg-gray-800 border-b border-gray-700 px-4 pb-4 shrink-0">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2.5 mt-1 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 lg:w-64 bg-gray-800 border-r border-gray-700 flex-col shrink-0">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span>⭐</span> Mission Control
          </h1>
        </div>

        <div className="px-4 py-3 flex items-center gap-2 text-sm border-b border-gray-700/50">
          <span className="text-gray-400">Status:</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-xs font-mono ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `w-full block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700/50">
          <p className="text-xs text-gray-600 font-mono">star_platinum_dc</p>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto bg-gray-900 min-h-0">
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default Layout;
