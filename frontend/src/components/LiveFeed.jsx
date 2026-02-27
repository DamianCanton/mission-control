import React, { useEffect, useRef } from 'react';
import { useMissionStore } from '../store/useMissionStore';

const getStatusColor = (status) => {
  switch (status) {
    case 'running': return 'bg-blue-900 text-blue-300 border-blue-700';
    case 'completed': return 'bg-green-900 text-green-300 border-green-700';
    case 'thinking': return 'bg-yellow-900 text-yellow-300 border-yellow-700';
    case 'error': return 'bg-red-900 text-red-300 border-red-700';
    default: return 'bg-gray-800 text-gray-300 border-gray-600';
  }
};

const LiveFeed = () => {
  const logs = useMissionStore(state => state.logs);
  const endOfListRef = useRef(null);

  useEffect(() => {
    endOfListRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-300 border border-gray-700 rounded-lg overflow-hidden shadow-lg">
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Live Execution Feed</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center italic mt-10">Awaiting incoming logs...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-3 bg-gray-800 border border-gray-700 rounded shadow-sm hover:border-gray-600 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(log.status)}`}>
                  {log.status}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-gray-200">{log.agentName}</span>
                <span className="text-gray-400">→</span>
                <span className="text-blue-400 font-semibold">{log.action}</span>
              </div>
              
              <div className="text-gray-400 mt-1 pl-2 border-l-2 border-gray-700 whitespace-pre-wrap">
                {log.details}
              </div>
            </div>
          ))
        )}
        <div ref={endOfListRef} />
      </div>
    </div>
  );
};

export default LiveFeed;