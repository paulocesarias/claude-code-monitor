import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { watch } from 'chokidar';
import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// Configuration
const PORT = process.env.PORT || 3001;
const CLAUDE_DIR = process.env.CLAUDE_DIR || join(process.env.HOME, '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const TODOS_DIR = join(CLAUDE_DIR, 'todos');

// CORS setup
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://claude.headbangtech.com', 'http://claude.headbangtech.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
}

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://claude.headbangtech.com', 'http://claude.headbangtech.com']
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Helper: Parse JSONL file
async function parseJsonlFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return [];
  }
}

// Helper: Get session info from conversation
function getSessionInfo(entries) {
  const userMessages = entries.filter(e => e.type === 'user');
  const assistantMessages = entries.filter(e => e.type === 'assistant');
  const toolCalls = entries.filter(e => e.type === 'tool_use' ||
    (e.message?.content && Array.isArray(e.message.content) &&
     e.message.content.some(c => c.type === 'tool_use')));

  const firstEntry = entries.find(e => e.timestamp);
  const lastEntry = [...entries].reverse().find(e => e.timestamp);

  // Extract tool calls from assistant messages
  const allToolCalls = [];
  assistantMessages.forEach(msg => {
    if (msg.message?.content && Array.isArray(msg.message.content)) {
      msg.message.content.forEach(c => {
        if (c.type === 'tool_use') {
          allToolCalls.push({
            name: c.name,
            timestamp: msg.timestamp
          });
        }
      });
    }
  });

  // Get first user message as summary
  const firstUserMsg = userMessages[0]?.message?.content;
  const summary = typeof firstUserMsg === 'string'
    ? firstUserMsg.slice(0, 100)
    : 'No description';

  return {
    startTime: firstEntry?.timestamp,
    lastActivity: lastEntry?.timestamp,
    messageCount: userMessages.length + assistantMessages.length,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    toolCalls: allToolCalls,
    toolCallCount: allToolCalls.length,
    summary,
    cwd: entries.find(e => e.cwd)?.cwd || 'Unknown',
    version: entries.find(e => e.version)?.version || 'Unknown'
  };
}

// Helper: Get todos for a session
async function getTodosForSession(sessionId) {
  try {
    const files = await readdir(TODOS_DIR);
    const todoFile = files.find(f => f.startsWith(sessionId));
    if (todoFile) {
      const content = await readFile(join(TODOS_DIR, todoFile), 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // No todos found
  }
  return [];
}

// Helper: Get all sessions
async function getAllSessions() {
  const sessions = [];

  try {
    const projectDirs = await readdir(PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir);
      const projectStat = await stat(projectPath);

      if (!projectStat.isDirectory()) continue;

      const files = await readdir(projectPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const sessionId = file.replace('.jsonl', '');
        const filePath = join(projectPath, file);
        const fileStat = await stat(filePath);

        // Skip empty files
        if (fileStat.size === 0) continue;

        const entries = await parseJsonlFile(filePath);
        if (entries.length === 0) continue;

        const sessionInfo = getSessionInfo(entries);
        const todos = await getTodosForSession(sessionId);

        sessions.push({
          id: sessionId,
          project: projectDir,
          ...sessionInfo,
          todos,
          isActive: isSessionActive(sessionInfo.lastActivity)
        });
      }
    }
  } catch (error) {
    console.error('Error getting sessions:', error);
  }

  // Sort by last activity (most recent first)
  return sessions.sort((a, b) =>
    new Date(b.lastActivity) - new Date(a.lastActivity)
  );
}

// Helper: Check if session is active (activity in last 5 minutes)
function isSessionActive(lastActivity) {
  if (!lastActivity) return false;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return new Date(lastActivity).getTime() > fiveMinutesAgo;
}

// Helper: Get session details
async function getSessionDetails(sessionId) {
  try {
    const projectDirs = await readdir(PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir);
      const filePath = join(projectPath, `${sessionId}.jsonl`);

      if (existsSync(filePath)) {
        const entries = await parseJsonlFile(filePath);
        const todos = await getTodosForSession(sessionId);

        // Get messages with full content
        const messages = entries
          .filter(e => e.type === 'user' || e.type === 'assistant')
          .map(e => ({
            type: e.type,
            timestamp: e.timestamp,
            content: e.message?.content,
            model: e.message?.model
          }));

        return {
          id: sessionId,
          project: projectDir,
          messages,
          todos,
          ...getSessionInfo(entries)
        };
      }
    }
  } catch (error) {
    console.error('Error getting session details:', error);
  }

  return null;
}

// API Routes
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await getSessionDetails(req.params.id);
    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const sessions = await getAllSessions();
    const activeSessions = sessions.filter(s => s.isActive);
    const totalToolCalls = sessions.reduce((sum, s) => sum + s.toolCallCount, 0);
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);

    res.json({
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      totalToolCalls,
      totalMessages,
      activeSessionIds: activeSessions.map(s => s.id)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-all for SPA in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// File watcher for real-time updates
const watcher = watch([PROJECTS_DIR, TODOS_DIR], {
  persistent: true,
  ignoreInitial: true,
  depth: 2
});

watcher.on('change', async (path) => {
  console.log('File changed:', path);

  // Emit update to all connected clients
  try {
    if (path.includes(TODOS_DIR)) {
      // Todo file changed
      const sessionId = path.split('/').pop().split('-agent-')[0];
      const todos = await getTodosForSession(sessionId);
      io.emit('todos-updated', { sessionId, todos });
    } else if (path.endsWith('.jsonl')) {
      // Session file changed
      const sessionId = path.split('/').pop().replace('.jsonl', '');
      const session = await getSessionDetails(sessionId);
      if (session) {
        io.emit('session-updated', session);
      }
    }

    // Also emit stats update
    const sessions = await getAllSessions();
    const stats = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.isActive).length,
      totalToolCalls: sessions.reduce((sum, s) => sum + s.toolCallCount, 0),
      totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0)
    };
    io.emit('stats-updated', stats);
  } catch (error) {
    console.error('Error processing file change:', error);
  }
});

watcher.on('add', async () => {
  // New session created
  const sessions = await getAllSessions();
  io.emit('sessions-list-updated', sessions);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Claude Code Monitor server running on port ${PORT}`);
  console.log(`Watching: ${PROJECTS_DIR}`);
  console.log(`Watching: ${TODOS_DIR}`);
});
