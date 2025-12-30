function SessionList({ sessions, selectedId, onSelect }) {
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const getProjectName = (project) => {
    if (!project) return 'Unknown';
    // Convert path to readable name
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

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">Sessions</h2>
        <p className="text-sm text-slate-400">{sessions.length} total</p>
      </div>

      <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto scrollbar-thin">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No sessions found
          </div>
        ) : (
          sessions.map((session) => {
            const todoProgress = getTodoProgress(session.todos);

            return (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={`w-full text-left p-4 hover:bg-slate-700/50 transition-colors ${
                  selectedId === session.id ? 'bg-slate-700' : ''
                }`}
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
                    <p className="text-xs text-slate-400 truncate mb-2">
                      {session.summary}
                    </p>

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
