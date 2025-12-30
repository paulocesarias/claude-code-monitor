function SessionDetails({ session }) {
  if (!session) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-center text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Select a session to view details</p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'in_progress':
        return (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getToolIcon = (toolName) => {
    if (toolName?.toLowerCase().includes('bash')) return '>';
    if (toolName?.toLowerCase().includes('read')) return 'R';
    if (toolName?.toLowerCase().includes('write')) return 'W';
    if (toolName?.toLowerCase().includes('edit')) return 'E';
    if (toolName?.toLowerCase().includes('glob')) return 'G';
    if (toolName?.toLowerCase().includes('grep')) return 'S';
    if (toolName?.toLowerCase().includes('task')) return 'T';
    if (toolName?.toLowerCase().includes('todo')) return 'L';
    return 'X';
  };

  // Group tool calls by type
  const toolCallsByType = session.toolCalls?.reduce((acc, tc) => {
    const name = tc.name || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-4">
      {/* Session Header */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {session.isActive && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                  Active
                </span>
              )}
              <h2 className="text-lg font-semibold text-white">
                {session.project?.replace(/^-/, '').replace(/-/g, '/') || 'Session'}
              </h2>
            </div>
            <p className="text-sm text-slate-400">{session.id}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-400">Version: <span className="text-white">{session.version}</span></p>
            <p className="text-slate-400">CWD: <span className="text-white font-mono text-xs">{session.cwd}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Started</p>
            <p className="text-white">{formatTime(session.startTime)}</p>
          </div>
          <div>
            <p className="text-slate-400">Last Activity</p>
            <p className="text-white">{formatTime(session.lastActivity)}</p>
          </div>
          <div>
            <p className="text-slate-400">Messages</p>
            <p className="text-white">{session.messageCount}</p>
          </div>
          <div>
            <p className="text-slate-400">Tool Calls</p>
            <p className="text-white">{session.toolCallCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Todos */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Tasks
          </h3>

          {!session.todos || session.todos.length === 0 ? (
            <p className="text-slate-500 text-sm">No tasks</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {session.todos.map((todo, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    todo.status === 'in_progress' ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-slate-700/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full ${getStatusColor(todo.status)} flex items-center justify-center text-white`}>
                    {getStatusIcon(todo.status)}
                  </div>
                  <span className={`text-sm flex-1 ${
                    todo.status === 'completed' ? 'text-slate-400 line-through' : 'text-white'
                  }`}>
                    {todo.status === 'in_progress' ? todo.activeForm : todo.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tool Calls Summary */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
            Tool Usage
          </h3>

          {Object.keys(toolCallsByType).length === 0 ? (
            <p className="text-slate-500 text-sm">No tool calls</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin">
              {Object.entries(toolCallsByType)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg">
                    <div className="w-6 h-6 rounded bg-slate-600 flex items-center justify-center text-xs font-mono text-slate-300">
                      {getToolIcon(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{name}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Messages */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Recent Messages
        </h3>

        {!session.messages || session.messages.length === 0 ? (
          <p className="text-slate-500 text-sm">No messages</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
            {session.messages.slice(-10).map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-blue-500/10 border border-blue-500/30'
                    : 'bg-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${
                    msg.type === 'user' ? 'text-blue-400' : 'text-orange-400'
                  }`}>
                    {msg.type === 'user' ? 'User' : 'Assistant'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">
                  {typeof msg.content === 'string'
                    ? msg.content
                    : Array.isArray(msg.content)
                      ? msg.content.find(c => c.type === 'text')?.text || '[Content]'
                      : '[Content]'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionDetails;
