import React from 'react';
import { useMissionStore } from '../store/useMissionStore';

const Layout = ({ children, currentView, setCurrentView }) => {
  const connected = useMissionStore(state => state.connected);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'livefeed', label: 'Live Feed' },
    { id: 'agents', label: 'Agents' },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>⭐</span> Mission Control
          </h1>
        </div>
        
        <div className="px-4 py-3 flex items-center gap-2 text-sm">
          <span className="text-gray-400">Status:</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === item.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-900">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;