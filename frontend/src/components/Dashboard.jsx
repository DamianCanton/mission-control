import React from 'react';
import { useMissionStore } from '../store/useMissionStore';

const Dashboard = () => {
  const logs = useMissionStore(state => state.logs);
  const agents = useMissionStore(state => state.agents);
  const connected = useMissionStore(state => state.connected);

  // Calcula métricas
  const totalLogs = logs.length;
  const activeAgents = agents.filter(a => a.status === 'running' || a.status === 'thinking').length;
  const successLogs = logs.filter(l => l.status === 'completed').length;
  const errorLogs = logs.filter(l => l.status === 'error').length;
  
  const successRate = totalLogs > 0 
    ? ((successLogs / totalLogs) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-8">System Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Logs */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">Total Events</p>
              <h3 className="text-3xl font-bold text-white">{totalLogs}</h3>
            </div>
            <div className="p-3 bg-blue-900/30 rounded-full">
              <span className="text-blue-400 text-xl">📄</span>
            </div>
          </div>
        </div>

        {/* Active Agents */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">Active Agents</p>
              <h3 className="text-3xl font-bold text-white">{activeAgents}</h3>
            </div>
            <div className="p-3 bg-green-900/30 rounded-full">
              <span className="text-green-400 text-xl">🤖</span>
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">Success Rate</p>
              <h3 className="text-3xl font-bold text-white">{successRate}%</h3>
            </div>
            <div className="p-3 bg-purple-900/30 rounded-full">
              <span className="text-purple-400 text-xl">🚀</span>
            </div>
          </div>
        </div>

        {/* Errors */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">Error Count</p>
              <h3 className="text-3xl font-bold text-white">{errorLogs}</h3>
            </div>
            <div className="p-3 bg-red-900/30 rounded-full">
              <span className="text-red-400 text-xl">⚠️</span>
            </div>
          </div>
        </div>
      </div>
      
      {!connected && (
        <div className="mt-8 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 flex items-center gap-3">
          <span>⚠️</span>
          <p>WebSocket disconnected. Waiting for connection to backend...</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;