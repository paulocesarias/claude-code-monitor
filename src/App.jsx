import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Dashboard from './components/Dashboard';
import SessionList from './components/SessionList';
import SessionDetails from './components/SessionDetails';

const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : 'http://localhost:3001';

function App() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initial data fetch
    fetchSessions();
    fetchStats();

    // Setup Socket.IO connection
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected to server');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });

    socket.on('session-updated', (session) => {
      setSessions(prev => {
        const index = prev.findIndex(s => s.id === session.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...session };
          return updated;
        }
        return [session, ...prev];
      });

      if (selectedSession?.id === session.id) {
        setSelectedSession(session);
      }
    });

    socket.on('todos-updated', ({ sessionId, todos }) => {
      setSessions(prev =>
        prev.map(s => s.id === sessionId ? { ...s, todos } : s)
      );

      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => ({ ...prev, todos }));
      }
    });

    socket.on('sessions-list-updated', (newSessions) => {
      setSessions(newSessions);
    });

    socket.on('stats-updated', (newStats) => {
      setStats(newStats);
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedSession?.id]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSelectSession = async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      setSelectedSession(data);
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Claude Code Monitor</h1>
              <p className="text-sm text-slate-400">Real-time agent activity dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse-dot' : 'bg-red-500'}`}></span>
            <span className="text-sm text-slate-400">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dashboard Stats */}
            <Dashboard stats={stats} />

            {/* Session Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Session List */}
              <div className="lg:col-span-1">
                <SessionList
                  sessions={sessions}
                  selectedId={selectedSession?.id}
                  onSelect={handleSelectSession}
                />
              </div>

              {/* Session Details */}
              <div className="lg:col-span-2">
                <SessionDetails session={selectedSession} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
