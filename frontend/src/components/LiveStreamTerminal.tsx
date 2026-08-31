import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function LiveStreamTerminal({ 
  connectionCode, 
  onRunEnd 
}: { 
  connectionCode: string; 
  onRunEnd?: () => void; 
}) {
  const [logs, setLogs] = useState<Array<{ log: string; timestamp?: string; stream?: string }>>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isRunActive, setIsRunActive] = useState(false);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastLogTimeRef = useRef<number>(Date.now());

  // Function to connect backend telemetry stream
  const connectWs = () => {
    if (!connectionCode || wsRef.current) return;

    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    let host = apiBase.replace(/^https?:\/\//, '');
    if (host.endsWith('/api')) host = host.replace(/\/api$/, '');
    const wsProtocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${host}/ws/project/${connectionCode}/logs/`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
        lastLogTimeRef.current = Date.now();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          lastLogTimeRef.current = Date.now();

          if (data.log) {
            setLogs((prev) => [...prev.slice(-400), {
              log: data.log,
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              stream: data.stream || 'stdout'
            }]);
          }

          if (data.event === 'run_end' || data.event === 'analysis_end') {
            setIsRunActive(false);
            if (onRunEnd) {
              onRunEnd();
            }
            window.dispatchEvent(new CustomEvent('noir_run_completed', { detail: { connectionCode } }));
            // Close stream after 3s grace period following task completion
            setTimeout(() => {
              disconnectWs();
            }, 3000);
          }
        } catch (err) {
          console.error('Stream parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('Stream connection error:', err);
        setIsWsConnected(false);
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        wsRef.current = null;
      };
    } catch (e) {
      console.warn('Stream init error:', e);
    }
  };

  // Function to disconnect telemetry stream
  const disconnectWs = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsWsConnected(false);
  };

  // Poll backend stream status every 3 seconds to auto-connect when CLI agent runs or analyzes
  useEffect(() => {
    if (!connectionCode) return;

    const checkStreamStatus = async () => {
      try {
        const res = await apiFetch(`/project/${connectionCode}/stream-status/`);
        if (res.ok) {
          const data = await res.json();
          const active = !!data.is_active;
          setIsRunActive(active);

          if (active && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING)) {
            wsRef.current = null;
            connectWs();
          }
        }
      } catch (err) {
        // Quiet fallback
      }
    };

    checkStreamStatus();
    const statusInterval = setInterval(checkStreamStatus, 1500);

    return () => {
      clearInterval(statusInterval);
    };
  }, [connectionCode]);

  // Timeout auto-disconnect if no log received for 30s while CLI is inactive
  useEffect(() => {
    const idleCheck = setInterval(() => {
      if (isWsConnected && !isRunActive) {
        const timeSinceLastLog = Date.now() - lastLogTimeRef.current;
        if (timeSinceLastLog > 30000) {
          disconnectWs();
        }
      }
    }, 5000);

    return () => clearInterval(idleCheck);
  }, [isWsConnected, isRunActive]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Terminal className="w-5 h-5 text-violet-400" />
            Real-Time Telemetry & Live Output
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Automatically streams live logs when <code className="text-violet-300 font-mono">noir run</code> or <code className="text-violet-300 font-mono">noir analyze</code> executes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Status Badge */}
          <span className={`flex items-center gap-1.5 text-[10px] font-mono px-3 py-1 rounded-full border transition-all ${
            isWsConnected 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold'
              : 'bg-stone-800/80 border-white/10 text-gray-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
            {isWsConnected ? 'LIVE STREAM ACTIVE' : 'STREAM IDLE (WAITING FOR RUN)'}
          </span>

          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-[10px] font-mono text-white/40 hover:text-white px-2 py-1 bg-white/5 rounded-lg border border-white/5 transition-all cursor-pointer"
            >
              Clear Logs
            </button>
          )}
        </div>
      </div>

      <div 
        ref={terminalRef}
        className="bg-black/80 border border-white/10 rounded-2xl p-4 font-mono text-xs text-stone-300 h-64 overflow-y-auto space-y-1 shadow-inner scrollbar-thin scrollbar-thumb-white/10"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/30 space-y-2">
            <Activity className={`w-8 h-8 text-violet-400/30 ${isWsConnected ? 'animate-pulse' : ''}`} />
            <p className="text-xs font-medium text-gray-400">
              {isWsConnected ? 'Live stream connected. Waiting for output...' : 'Stream automatically activates when an agent task begins.'}
            </p>
            <p className="text-[10px] font-mono text-white/30">
              Run <span className="text-violet-300">$ noir run</span> or <span className="text-violet-300">$ noir analyze</span> in your connected workspace to view live telemetry.
            </p>
          </div>
        ) : (
          logs.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 hover:bg-white/5 p-0.5 rounded transition-colors">
              <span className="text-violet-400/60 text-[10px] select-none min-w-[55px] font-mono">
                {item.timestamp}
              </span>
              <span className={item.stream === 'stderr' ? 'text-rose-400' : 'text-emerald-300'}>
                {item.log}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
