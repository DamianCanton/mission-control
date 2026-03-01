import React, { useEffect, useRef } from 'react';
import { useMissionStore } from '../store/useMissionStore';

const STATUS_COLOR = {
  running:   'bg-blue-900   text-blue-300   border-blue-700',
  completed: 'bg-green-900  text-green-300  border-green-700',
  thinking:  'bg-yellow-900 text-yellow-300 border-yellow-700',
  error:     'bg-red-900    text-red-300    border-red-700',
};

function statusColor(s) { return STATUS_COLOR[s] ?? 'bg-gray-800 text-gray-300 border-gray-600'; }

const LiveFeed = () => {
  const logs         = useMissionStore(state => state.logs);
  const endOfListRef = useRef(null);

  useEffect(() => {
    endOfListRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col bg-gray-900 text-gray-300 border border-gray-700 rounded-lg overflow-hidden shadow-lg"
         style={{ height: 'calc(100dvh - 130px)' }}>

      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
        <h2 className="text-base md:text-lg font-semibold text-white">Live Execution Feed</h2>
        <span className="text-xs text-gray-500 font-mono">{logs.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 font-mono text-xs md:text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center italic mt-10">Awaiting incoming logs...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id}
                 className="p-3 bg-gray-800 border border-gray-700 rounded shadow-sm hover:border-gray-600 transition-colors">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="text-gray-500 text-xs shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs border shrink-0 ${statusColor(log.status)}`}>
                  {log.status}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="font-bold text-gray-200">{log.agentName}</span>
                <span className="text-gray-500">→</span>
                <span className="text-blue-400 font-semibold break-all">{log.action}</span>
              </div>

              {log.details && (
                <div className="text-gray-400 mt-1 pl-2 border-l-2 border-gray-700 break-all line-clamp-3">
                  {log.details}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endOfListRef} />
      </div>
    </div>
  );
};

export default LiveFeed;
