# FlipLab - Competitive Beat Making Platform

## Overview

FlipLab is a real-time multiplayer music production game where 4 producers compete in 10-minute beat battles. Players flip samples across genres (soul, funk, jazz), add drums, and vote on the best creations. The application features a React frontend with a dark cyber-lab aesthetic, an Express backend with WebSocket support for real-time matchmaking, and PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### December 2024
- Added WaveSurfer.js for real audio waveform visualization in the Studio
- Implemented beat grid overlay showing bar markers aligned with sample BPM
- Synchronized drum sequencer with sample playback (shared transport)
- Added drafts system for saving work in progress with database persistence
- Updated Voting page with real API integration (+14 points to winner)
- Added authorization checks for draft update/delete endpoints
- Marked all samples as drumless for beat-making compatibility
- Fixed matchmaking by migrating from MemStorage to PostgreSQL DatabaseStorage

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state, React hooks for local state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for page transitions and UI effects
- **Audio**: Web Audio API for drum playback, WaveSurfer.js for waveform visualization
- **File Uploads**: Uppy with AWS S3 presigned URL flow

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Real-time**: WebSocket server (ws library) for matchmaking and game state sync
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Build System**: esbuild for server bundling, Vite for client bundling
- **Development**: Hot module replacement via Vite middleware

### Key Design Patterns
- **Matchmaking System**: Queue-based matchmaking grouped by music genre, with 4 players per match (Battle mode) or 2 players (Duel mode)
- **WebSocket Communication**: Event-driven messaging for match notifications, player sync, and game state updates
- **Presigned URL Uploads**: Two-step upload flow - request URL from backend, upload directly to storage
- **DatabaseStorage**: PostgreSQL-backed storage for persistent data across server restarts

### Database Schema
- **users**: Player profiles with ratings, wins, and match statistics
- **matches**: Game sessions with status tracking (waiting, active, voting, showcase, completed)
- **matchParticipants**: Links players to matches with their audio submissions
- **votes**: Player votes for best flip in each match
- **leaderboard**: Denormalized rankings for fast retrieval
- **matchmakingQueue**: Queue entries for players waiting to be matched
- **drafts**: Saved work-in-progress beats with drum patterns and effect settings

### Audio System
- WaveSurfer.js for real waveform visualization with progress tracking
- Browser-based drum machine with preloaded Boom Bap II samples
- 5 drum categories: kicks, snares, hats, open hats, percs
- 16-step drum sequencer synchronized with sample playback
- Audio effects: compressor, reverb, delay (routed through Web Audio API)

### Studio Features
- Real-time waveform visualization with playhead
- Beat grid overlay aligned with sample BPM (markers every 4 beats)
- Synchronized transport: sample and drums play together on tempo
- Save Draft functionality with drafts panel for loading saved work
- Effects rack: compressor, reverb, delay with adjustable parameters

### Voting System
- After 10-minute battle ends, players vote for best flip
- Winner receives +14 points (+12 if player left mid-round)
- Points update leaderboard in real-time
- WebSocket broadcasts voting results to all players

## External Dependencies

### Database
- **PostgreSQL**: Primary data store via DATABASE_URL environment variable
- **Drizzle Kit**: Database migrations and schema management

### File Storage
- **Google Cloud Storage**: Object storage for drum pack uploads
- **Replit Sidecar**: Token management for GCS authentication (port 1106)

### Third-Party Libraries
- **wavesurfer.js**: Audio waveform visualization
- **@tanstack/react-query**: Server state caching and synchronization
- **framer-motion**: Animation library for UI transitions
- **@uppy/core + @uppy/aws-s3**: File upload handling with S3 presigned URLs
- **ws**: WebSocket server implementation
- **zod + drizzle-zod**: Runtime validation for API inputs and database schemas

### Development Tools
- **Vite**: Frontend dev server with HMR
- **@replit/vite-plugin-cartographer**: Development tooling integration
- **tsx**: TypeScript execution for development server

## Known Limitations
- Authentication uses localStorage-based userId (not session-based)
- Draft authorization relies on client-supplied userId
- Sample files need to be replaced with actual drumless audio tracks
