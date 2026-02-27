import React from 'react';
import { useMissionStore } from '../store/useMissionStore';

const getStatusBadge = (status) => {
  switch (status) {
    case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'completed': return 'bg-green-100 text-green-800 border-green-200';
    case 'thinking': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'error': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Unknown';
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
};

const Agents = () => {
  const agents = useMissionStore(state => state.agents);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-8">Active Agents</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-10">
            No agents currently active
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-lg hover:border-gray-500 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 font-bold text-lg">
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                    <p className="text-sm text-gray-400 font-mono text-xs">{agent.id}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Current Status:</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(agent.status)}`}>
                    {agent.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Last Seen:</span>
                  <span className="text-gray-300 font-mono text-xs">
                    {formatTimeAgo(agent.lastSeen)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Agents;