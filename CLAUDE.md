# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `node start.js` (runs on port 3000)
- **Start with auto-reload**: `npm run watch` (uses nodemon)
- **Install dependencies**: `npm install`

## Docker Commands

- **Build image**: `docker build -t meeting-timeline .`
- **Run with Docker Compose**: `docker-compose up` (starts both Node.js app and Redis)

## Architecture Overview

This is a Node.js/Express meeting timeline application that creates visual meeting agendas with countdown timers, designed to be used with OBS virtual camera for video conferencing.

### Core Components

- **Entry point**: `start.js` - Sets up Express server with security headers and static file serving
- **App configuration**: `app.js` - Configures Express routes and middleware
- **Routes**:
  - `routes/index.js` - Redirects root to `/meeting/`
  - `routes/meeting.js` - Main meeting CRUD operations and timeline rendering
- **Frontend**: Uses PixiJS for timeline visualization with blue chroma key background for OBS integration

### Data Storage

- **Redis**: Primary data store for meeting configurations
- **Environment variable**: `REDIS_URL` (defaults to 127.0.0.1)
- **Meeting data structure**: Stored as JSON with topics, durations, persons, timezones

### Key Features

- Meeting creation with timezone support (popular timezones: US/Pacific, America/Phoenix, US/Eastern, Asia/Kolkata)
- Timeline visualization with PixiJS graphics engine
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