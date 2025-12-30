# Claude Code Monitor

Real-time web dashboard for monitoring Claude Code agent activity.

**Live Demo**: https://claude.headbangtech.cloud

## Features

- **Live Session Tracking**: See all active and past Claude Code sessions
- **Real-time Updates**: WebSocket-based live updates when sessions change
- **Task Progress**: View todo lists and task completion status
- **Tool Usage Analytics**: Track which tools agents are using
- **Message History**: Browse recent conversation messages
- **Session Filtering**: Filter by Active, Last 24h, or All sessions
- **Google SSO**: Secure authentication with email allowlist
- **Duplicate Handling**: Automatically finds the most recent session file when duplicates exist
- **Warmup Filtering**: Internal warmup/sidechain agent sessions are hidden

## Setup

### Prerequisites

- Node.js 18+
- Claude Code installed and used (creates `~/.claude` directory)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts both the backend server (port 3001) and Vite dev server (port 5173).

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t claude-code-monitor .
docker run -p 3001:3001 -v ~/.claude:/root/.claude:ro claude-code-monitor
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `CLAUDE_DIR` | `~/.claude` | Path to Claude Code data directory |
| `NODE_ENV` | development | Set to `production` for production mode |
| `JWT_SECRET` | - | Secret for JWT token signing (required for auth) |
| `GOOGLE_CLIENT_ID` | - | Google OAuth Client ID |
| `ALLOWED_EMAILS` | - | Comma-separated list of allowed email addresses |
| `VITE_GOOGLE_CLIENT_ID` | - | Same as GOOGLE_CLIENT_ID (for frontend) |

## Architecture

- **Backend**: Express.js server that reads Claude Code JSONL files
- **Frontend**: React + Vite + Tailwind CSS
- **Real-time**: Socket.IO for live updates
- **File Watching**: Chokidar watches for file changes

## Data Sources

The app reads from:
- `~/.claude/projects/*/` - Session conversation files (JSONL)
- `~/.claude/todos/` - Task/todo lists for each session
