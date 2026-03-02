import React from 'react';
import { useMissionStore } from '../store/useMissionStore';
import OfficeMap from './OfficeMap';

const StatCard = ({ label, value, icon, colorClass }) => (
  <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700 shadow-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs md:text-sm font-medium text-gray-400 mb-1">{label}</p>
        <h3 className="text-2xl md:text-3xl font-bold text-white">{value}</h3>
      </div>
      <div className={`p-2.5 md:p-3 ${colorClass} rounded-full`}>
        <span className="text-lg md:text-xl">{icon}</span>
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const logs      = useMissionStore(state => state.logs);
  const agents    = useMissionStore(state => state.agents);
  const connected = useMissionStore(state => state.connected);

  const totalLogs    = logs.length;
  const activeAgents = agents.filter(a => a.status === 'running' || a.status === 'thinking').length;
  const successLogs  = logs.filter(l => l.status === 'completed').length;
  const errorLogs    = logs.filter(l => l.status === 'error').length;
  const successRate  = totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <h2 className="text-2xl md:text-3xl font-bold text-white">System Overview</h2>

      {/* 3D map — mobile: basado en vw / desktop: fijo en alto generoso */}
      <div className="rounded-lg overflow-hidden border border-gray-700 h-[320px] sm:h-[380px] md:h-[580px] lg:h-[640px]">
        <OfficeMap />
      </div>

      {/* Stats grid — 2 cols en mobile, 4 en desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard label="Total Events"  value={totalLogs}      icon="📄" colorClass="bg-blue-900/30"   />
        <StatCard label="Active Agents" value={activeAgents}   icon="🤖" colorClass="bg-green-900/30"  />
        <StatCard label="Success Rate"  value={`${successRate}%`} icon="🚀" colorClass="bg-purple-900/30" />
        <StatCard label="Error Count"   value={errorLogs}      icon="⚠️" colorClass="bg-red-900/30"    />
      </div>

      {!connected && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 flex items-center gap-3 text-sm">
          <span>⚠️</span>
          <p>WebSocket disconnected. Waiting for backend...</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
