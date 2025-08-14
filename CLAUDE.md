# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `node start.js` (runs on port 3000)
- **Start with auto-reload**: `npm run watch` (uses nodemon)
- **Install dependencies**: `npm install`

## Environment Configuration

Copy `.env.example` to `.env` and configure the following variables:

```bash
cp .env.example .env
```

### Required Environment Variables

- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `GOOGLE_CALLBACK_URL`: OAuth callback URL (default: http://localhost:3000/auth/google/callback)
- `SESSION_SECRET`: Secret key for session management (generate a strong random string)

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to "Credentials" > "Create Credentials" > "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs: `http://localhost:3000/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` file

## Docker Commands

- **Build image**: `docker build -t meeting-timeline .`
- **Run with Docker Compose**: `docker-compose up` (starts both Node.js app and Redis)

## Architecture Overview

This is a Node.js/Express meeting timeline application that creates visual meeting agendas with countdown timers, designed to be used with OBS virtual camera for video conferencing.

### Core Components

- **Entry point**: `start.js` - Sets up Express server with security headers and static file serving
- **App configuration**: `app.js` - Configures Express routes and middleware
- **Routes**:
  - `routes/index.js` - Redirects root to `/meeting/` (with auth check)
  - `routes/meeting.js` - Main meeting CRUD operations and timeline rendering (protected)
  - `routes/auth.js` - Google OAuth authentication routes (/auth/login, /auth/logout, /auth/google/*)
- **Frontend**: Uses PixiJS for timeline visualization with blue chroma key background for OBS integration

### Data Storage

- **Redis**: Primary data store for meeting configurations
- **Environment variable**: `REDIS_URL` (defaults to 127.0.0.1)
- **Meeting data structure**: Stored as JSON with topics, durations, persons, timezones
- **User-specific storage**: Meeting keys are prefixed with user email: `meeting_{user_email}_{meeting_id}`

### Authentication System

- **Google OAuth 2.0**: Users authenticate with their Google accounts
- **Session-based**: User sessions managed with express-session
- **User isolation**: Each user can only access their own meetings
- **Protected routes**: All meeting routes require authentication

### Key Features

- Meeting creation with timezone support (popular timezones: US/Pacific, America/Phoenix, US/Eastern, Asia/Kolkata)
- Timeline visualization with PixiJS graphics engine
- Modern scroll-based zoom functionality with mouse wheel
- Double-click to reset zoom to optimal view
- Keyboard shortcut (R) for quick zoom reset
- Blue background (hex: 0047BB) for OBS chroma key integration
- Meeting editing and listing functionality
- Duration parsing and timeline calculation

### Frontend JavaScript Architecture

- **New timeline system** (untracked files):
  - `public/js/timelineManager.js` - ES6 module managing PixiJS timeline rendering
  - `public/js/timelineUtils.js` - Utility functions for timeline calculations and event handling
- **Existing scripts**:
  - `public/js/create_meeting.js` - Meeting creation form handling
  - `public/js/form-validation.js` - Client-side form validation

### Template System

- **EJS templates** in `views/` directory
- **Modular structure**: `meeting_header.ejs` and `meeting_footer.ejs` for reusable components
- **Main templates**: `create_meeting.ejs`, `edit_meeting.ejs`, `meeting.ejs`, `index.ejs`

### Meeting Data Flow

1. Meeting created via form → stored in Redis with generated short hash ID
2. Meeting accessed via `/meeting/:meetingId` → data retrieved from Redis
3. Timeline calculations performed server-side in `getDataFromRedis()` and `getData()` functions
4. Frontend renders timeline using PixiJS with calculated positions and durations

### Dependencies

- **Backend**: Express, EJS, Redis clients (redis + ioredis), moment-timezone, crypto-js, helmet
- **Frontend**: PixiJS (bundled as pixi.min.js), moment.js for time handling
- **Development**: nodemon for auto-reload during development