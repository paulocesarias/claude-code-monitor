import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
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

// Auth configuration
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').filter(Boolean);
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// CORS setup
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://claude.headbangtech.cloud', 'http://claude.headbangtech.cloud']
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Auth middleware
const requireAuth = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Auth routes
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'No credential provided' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Check if email is allowed
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
      return res.status(403).json({ error: 'Access denied. Email not authorized.' });
    }

    // Create JWT token
    const token = jwt.sign(
      { email, name, picture, googleId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ user: { email, name, picture } });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Serve static files in production (before auth middleware for assets)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
}

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token ||
    socket.handshake.headers.cookie?.split(';')
      .find(c => c.trim().startsWith('auth_token='))
      ?.split('=')[1];

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
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
  const sessionsMap = new Map(); // Use Map to deduplicate by session ID

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

        // Use file modification time for deduplication (faster than parsing)
        const existingSession = sessionsMap.get(sessionId);
        if (existingSession && existingSession.mtime >= fileStat.mtime) {
          continue; // Skip if we already have a newer version
        }

        const entries = await parseJsonlFile(filePath);
        if (entries.length === 0) continue;

        // Skip warmup/internal agent sessions
        if (isWarmupSession(entries)) continue;

        const sessionInfo = getSessionInfo(entries);
        const todos = await getTodosForSession(sessionId);

        sessionsMap.set(sessionId, {
          id: sessionId,
          project: projectDir,
          filePath, // Store for getSessionDetails
          mtime: fileStat.mtime,
          ...sessionInfo,
          todos,
          isActive: isSessionActive(sessionInfo.lastActivity)
        });
      }
    }
  } catch (error) {
    console.error('Error getting sessions:', error);
  }

  // Convert map to array and sort by last activity (most recent first)
  const sessions = Array.from(sessionsMap.values());
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

// Helper: Check if session is a warmup/internal agent session
function isWarmupSession(entries) {
  const firstUserEntry = entries.find(e => e.type === 'user');
  // Warmup sessions are sidechains with just "Warmup" as the first message
  if (firstUserEntry?.isSidechain && firstUserEntry?.message?.content === 'Warmup') {
    return true;
  }
  return false;
}

// Helper: Get session details
async function getSessionDetails(sessionId) {
  try {
    const projectDirs = await readdir(PROJECTS_DIR);

    // Find all matching files and pick the most recently modified one
    let bestMatch = null;
    let bestMtime = 0;

    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir);
      const filePath = join(projectPath, `${sessionId}.jsonl`);

      if (existsSync(filePath)) {
        const fileStat = await stat(filePath);
        if (fileStat.mtime.getTime() > bestMtime) {
          bestMtime = fileStat.mtime.getTime();
          bestMatch = { filePath, projectDir };
        }
      }
    }

    if (!bestMatch) return null;

    const entries = await parseJsonlFile(bestMatch.filePath);
    const todos = await getTodosForSession(sessionId);

    // Get messages with full content
    // JSONL entries are already in chronological order, so use index as fallback
    const allMessages = entries
      .map((e, idx) => ({ ...e, _index: idx }))
      .filter(e => e.type === 'user' || e.type === 'assistant')
      .map(e => ({
        type: e.type,
        timestamp: e.timestamp,
        content: e.message?.content,
        model: e.message?.model,
        _index: e._index
      }));

    // Get last 10 messages (most recent), sorted newest first for display
    const messages = allMessages
      .slice(-10)
      .reverse();

    return {
      id: sessionId,
      project: bestMatch.projectDir,
      messages,
      todos,
      ...getSessionInfo(entries)
    };
  } catch (error) {
    console.error('Error getting session details:', error);
  }

  return null;
}

// Protected API Routes
app.get('/api/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', requireAuth, async (req, res) => {
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

app.get('/api/stats', requireAuth, async (req, res) => {
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
  console.log('Client connected:', socket.id, socket.user?.email);

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
  console.log(`Google Auth: ${GOOGLE_CLIENT_ID ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`Allowed emails: ${ALLOWED_EMAILS.length > 0 ? ALLOWED_EMAILS.join(', ') : 'All (no restriction)'}`);
});
