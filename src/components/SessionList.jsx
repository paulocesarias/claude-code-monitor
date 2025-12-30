import { useState } from 'react';

function SessionList({ sessions, selectedId, onSelect }) {
  const [filter, setFilter] = useState('active'); // 'active', 'recent', 'all'

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const getProjectName = (project) => {
    if (!project) return 'Unknown';
    return project
      .replace(/^-/, '')
      .replace(/-/g, '/')
      .split('/')
      .pop() || project;
  };

  const getTodoProgress = (todos) => {
    if (!todos || todos.length === 0) return null;
    const completed = todos.filter(t => t.status === 'completed').length;
    const inProgress = todos.filter(t => t.status === 'in_progress').length;
    return { completed, inProgress, total: todos.length };
  };

  // Filter and sort sessions
  const getFilteredSessions = () => {
    let filtered = [...sessions];

    // Sort by lastActivity descending (most recent first)
    filtered.sort((a, b) => {
      const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return timeB - timeA;
    });

    switch (filter) {
      case 'active':
        return filtered.filter(s => s.isActive);
      case 'recent':
        // Last 24 hours
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return filtered.filter(s => {
          const time = s.lastActivity ? new Date(s.lastActivity).getTime() : 0;
          return time > dayAgo;
        });
      default:
        return filtered.slice(0, 100); // Limit to 100 for performance
    }
  };

  const filteredSessions = getFilteredSessions();
  const activeSessions = sessions.filter(s => s.isActive);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header with filter tabs */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Sessions</h2>
          {activeSessions.length > 0 && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              {activeSessions.length} active
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
          <button
            onClick={() => setFilter('active')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === 'active'
                ? 'bg-green-500/20 text-green-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active ({activeSessions.length})
          </button>
          <button
            onClick={() => setFilter('recent')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === 'recent'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            24h
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-slate-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto scrollbar-thin">
        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {filter === 'active' ? 'No active sessions' : 'No sessions found'}
          </div>
        ) : (
          filteredSessions.map((session) => {
            const todoProgress = getTodoProgress(session.todos);
            const currentTask = session.todos?.find(t => t.status === 'in_progress');

            return (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={`w-full text-left p-4 hover:bg-slate-700/50 transition-colors ${
                  selectedId === session.id ? 'bg-slate-700' : ''
                } ${session.isActive ? 'border-l-2 border-l-green-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {session.isActive && (
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot flex-shrink-0"></span>
                      )}
                      <span className="text-sm font-medium text-white truncate">
                        {getProjectName(session.project)}
                      </span>
                    </div>

                    {/* Show current task if active */}
                    {session.isActive && currentTask ? (
                      <p className="text-xs text-orange-400 truncate mb-2 flex items-center gap-1">
                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {currentTask.activeForm}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 truncate mb-2">
                        {session.summary}
                      </p>
                    )}

                    {/* Todo Progress */}
                    {todoProgress && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                            style={{ width: `${(todoProgress.completed / todoProgress.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">
                          {todoProgress.completed}/{todoProgress.total}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {session.messageCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        </svg>
                        {session.toolCallCount}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatTime(session.lastActivity)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SessionList;
