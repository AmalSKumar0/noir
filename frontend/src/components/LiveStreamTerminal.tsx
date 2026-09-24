import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { getAccessToken } from '../utils/auth';

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
    const token = getAccessToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${wsProtocol}//${host}/ws/project/${connectionCode}/logs/${tokenQuery}`;

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

  // Poll backend stream status only when disconnected to auto-connect when CLI agent runs or analyzes
  useEffect(() => {
    if (!connectionCode) return;
    if (isWsConnected) return;

    const checkStreamStatus = async () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
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
    const statusInterval = setInterval(checkStreamStatus, 5000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [connectionCode, isWsConnected]);

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
    <div className="bg-[#0D0F17] border border-zinc-800/80 rounded-lg p-3.5 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-xs font-semibold flex items-center gap-2 text-zinc-200 uppercase tracking-wider font-mono">
            <Terminal className="w-3.5 h-3.5 text-violet-400" />
            Real-Time Telemetry & Process Stream
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
            WebSocket telemetry from <code className="text-zinc-300">noir run</code> or <code className="text-zinc-300">noir fault listen</code>.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Status Badge */}
          <span className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
            isWsConnected 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-medium'
              : 'bg-zinc-800/80 border-zinc-750 text-zinc-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
            {isWsConnected ? 'WS CONNECTED' : 'WS IDLE (WAITING)'}
          </span>

          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div 
        ref={terminalRef}
        className="bg-[#090A0F] border border-zinc-800/80 rounded-md p-3 font-mono text-[11px] text-zinc-300 h-64 overflow-y-auto space-y-1 shadow-inner select-text"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-1.5 py-6">
            <Activity className={`w-6 h-6 text-zinc-600 ${isWsConnected ? 'animate-pulse text-emerald-500' : ''}`} />
            <p className="text-xs font-medium text-zinc-400">
              {isWsConnected ? 'Live stream connected. Awaiting agent output...' : 'Stream automatically activates when agent runs.'}
            </p>
            <p className="text-[10px] font-mono text-zinc-500">
              Execute <span className="text-zinc-300">noir run</span> or <span className="text-zinc-300">noir fault listen</span> in your workspace.
            </p>
          </div>
        ) : (
          logs.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 hover:bg-zinc-900/60 p-0.5 rounded transition-colors">
              <span className="text-zinc-500 text-[10px] select-none min-w-[55px] font-mono">
                {item.timestamp}
              </span>
              <span className={item.stream === 'stderr' ? 'text-rose-400' : 'text-emerald-400'}>
                {item.log}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
