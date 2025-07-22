# Tournament Management System

## Overview

This is a full-stack tournament management system built for the Forest Glade Falcons baseball organization. The application provides real-time tournament management capabilities including team registration, game scheduling, score tracking, standings calculation, and playoff bracket management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: PostgreSQL session store
- **Development**: TSX for TypeScript execution

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database serverless
- **ORM**: Drizzle ORM with schema-first approach
- **Session Storage**: PostgreSQL with connect-pg-simple
- **Migrations**: Drizzle Kit for database schema management

## Key Components

### Database Schema
- **Users Table**: Basic user authentication with username/password
- **Schema Location**: `/shared/schema.ts` using Drizzle ORM
- **Migration Management**: Drizzle Kit with PostgreSQL dialect

### Recent Changes (January 2025)
- **Division Toggle**: Added interactive division switching for standings display (11U/13U)
- **Hierarchical Score Input**: Restructured coach score input flow (Division → Team → Pool games)
- **Admin Portal Enhancement**: Moved new tournament and export functionality to admin portal
- **Access Control**: Separated admin functions from public dashboard for better security
- **StyleMix Baseball Theme**: Applied professional baseball styling with authentic colors and fonts
  - Colors: Forest Green (#177e0e) and Yellow (#fbbf24) throughout the app
  - Fonts: Oswald for headings, Roboto for body text
  - Typography: Uppercase headings with letter spacing for professional sports look
  - Background: Light gray (#F5F5F5) for subtle contrast
  - Navigation: White header with forest green accents and F logo
- **UI Label Updates**: Changed innings labels to "Home/Away Innings Batted" for clarity

### Frontend Components
- **Tournament Dashboard**: Main interface for tournament management
- **Navigation**: Responsive navigation with mobile menu support
- **Tournament Cards**: Overview cards showing tournament statistics
- **Standings Table**: Real-time standings with tie-breaker logic and division toggle
- **Games Management**: Game scheduling and score submission
- **Teams Management**: Team registration and information
- **Playoffs**: Tournament bracket management
- **Admin Portal**: Administrative functions including tournament creation with auto-generated IDs, data import with tournament selection, game result editing with filtering, CSV reimport tool, and export capabilities
- **Hierarchical Score Input**: Step-by-step score submission workflow for coaches
- **Diamond GPS Coordinates** (all at 3215 Forest Glade Dr, Windsor, ON): 
  - Bernie Amlin Field (BAF): 42.208056, -83.009443
  - Tom Wilson Field (TWF): 42.209054, -83.008994
  - Optimist 1 (OPT1): 42.208169, -83.008209
  - Optimist 2 (OPT2): 42.208594, -83.007789
  - Donna Bombardier Diamond (DBD): 42.209259, -83.009798

### Authentication System
- **Storage Interface**: Abstracted storage layer with PostgreSQL implementation
- **User Management**: Create, retrieve, and authenticate users with bcrypt password hashing
- **Session Handling**: Express session management with PostgreSQL session store
- **Access Control**: Role-based authentication with admin-only routes
- **Login Flow**: Dedicated login page at `/login` with form validation
- **Setup Flow**: Initial admin setup at `/setup` for first-time configuration
- **Protected Routes**: Admin portal requires authentication and admin privileges

## Data Flow

1. **Client Requests**: React components make API calls through TanStack Query
2. **Server Processing**: Express routes handle API requests
3. **Database Operations**: Drizzle ORM manages PostgreSQL interactions
4. **Real-time Updates**: Firebase Firestore for live tournament data
5. **State Management**: TanStack Query caches and synchronizes server state

## External Dependencies

### Core Dependencies
- **Database**: `@neondatabase/serverless` for PostgreSQL connection
- **ORM**: `drizzle-orm` and `drizzle-zod` for database operations
- **UI Framework**: Radix UI components for accessible UI primitives
- **Styling**: Tailwind CSS with PostCSS processing
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: `date-fns` for date manipulations

### Firebase Integration
- **Real-time Database**: Firebase Firestore for live tournament data
- **Authentication**: Firebase Auth for user management
- **Configuration**: Environment-based Firebase configuration

### Development Tools
- **Build**: Vite with React plugin and TypeScript support
- **Development**: TSX for TypeScript execution
- **Code Quality**: TypeScript strict mode enabled
- **Debugging**: Replit-specific development tools

## Deployment Strategy

### Build Process
1. **Frontend Build**: Vite compiles React/TypeScript to static assets
2. **Backend Build**: esbuild bundles server code for production
3. **Output**: Frontend assets in `/dist/public`, server bundle in `/dist`

### Environment Configuration
- **Development**: `NODE_ENV=development` with hot reloading
- **Production**: `NODE_ENV=production` with optimized builds
- **Database**: `DATABASE_URL` environment variable required

### Server Configuration
- **Static Files**: Express serves built frontend assets
- **API Routes**: All API endpoints prefixed with `/api`
- **Error Handling**: Centralized error handling middleware
- **Logging**: Request/response logging for API endpoints

### Database Management
- **Schema**: Defined in `/shared/schema.ts`
- **Migrations**: Run via `npm run db:push`
- **Connection**: Serverless PostgreSQL via Neon Database

## Recent Changes

- Updated logo and branding to "The Nest" (January 2025)
- Fixed application startup issues and port conflicts (January 2025)
- Enhanced admin portal with tournament creation form and auto-generated IDs (January 2025)
- Added tournament selection for CSV data imports (January 2025)
- Implemented game result editor with filtering by tournament, division, and team (January 2025)
- Reorganized admin portal with tabbed interface (January 2025)
- Added standalone tournament URLs with dedicated /tournament/{id} routes (January 2025)
- Enhanced tournament creation with immediate URL preview and navigation (January 2025)
- Redesigned game schedule to list format with cascading division/team filters (January 2025)
- Added venue and sub-venue (diamond) information display for each game (January 2025)
- Integrated GPS coordinates for 5 baseball diamonds with walking directions via Google Maps (January 2025)
- Fixed time conversion from Central to Eastern Time in game schedule (January 2025)
- Identified CSV import column misalignment issue - data was shifted causing diamond names to be lost (January 2025)
- Added CSV reimport tool to admin portal for fixing data import issues (January 2025)
- Updated diamond coordinate mappings to match CSV format with full names and abbreviations (January 2025)
- Fixed CSV reimport ID generation to match main import format, stripping "Pool" prefix for consistency (January 2025)
- Simplified tournament dashboard UI by removing Total Teams, Games Progress, and Divisions cards (January 2025)
- Removed pool selection buttons from standings display - now shows all pools simultaneously (January 2025)
- Restored pool tabs in standings display for better navigation between pools (January 2025)
- Removed Coach Score Input button from tournament dashboard (January 2025)
- Fixed CSV import to handle all 49 games including playoff games with placeholder teams (January 2025)
- Made homeTeamId and awayTeamId nullable in games table to support future TBD playoff teams (January 2025)
- Added isPlayoff boolean field to games table for proper game type identification (January 2025)
- Enhanced CSV header mapping to handle multiple column name variations (January 2025)
- Fixed venue/subVenue data mapping to properly import diamond information on first import (January 2025)
- Corrected CSV column mapping to use 'venue' instead of 'location' to match actual CSV headers (January 2025)
- Implemented proper CSV parsing that handles quoted values containing commas (January 2025)
- Added comprehensive tournament management UI with edit and delete functionality (January 2025)
- Integrated TournamentManager component with dropdown menus for each tournament (January 2025)
- Implemented edit dialog for updating tournament names and dates (January 2025)
- Added delete confirmation dialog with cascade warning for safe tournament removal (January 2025)
- Implemented role-based authentication system with bcrypt password hashing (January 2025)
- Added admin login page and session management with express-session (January 2025)
- Protected admin routes with requireAdmin middleware for secure access control (January 2025)
- Created setup page for initial admin user creation with username "admin" (January 2025)
- Added logout functionality in admin portal with session destruction (January 2025)
- Fixed production authentication issue by implementing PostgreSQL session storage (January 2025)
- Added placeholder team filtering to exclude "seed", "Winner Pool X", "TBD" etc. from standings and dropdowns (January 2025)
- Converted Teams page from card layout to table format with division filtering (January 2025)
- Added new team data columns: Roster link, Pitch Count App Name, Pitch Count Name, Game Changer Name (January 2025)
- Created API endpoint for populating team data fields based on team information (January 2025)
- Implemented Automated Roster Import Tool with fuzzy team name matching from playoba.ca (January 2025)
- Added Python-based web scraping service for OBA roster data extraction (January 2025)
- Created roster search and import API endpoints with caching support (January 2025)
- Added roster import UI in Teams tab with confirmation dialog for fuzzy matches (January 2025)
- Fixed roster import team name matching to handle OBA format ("11U HS Forest Glade") vs internal format ("Forest Glade Falcons - 11U Rep") (January 2025)
- Updated roster scraper to understand OBA URL structure with affiliate numbers (#/{affiliate_number}/team/{team_number}/roster) supporting 21 different affiliates (January 2025)
- Enhanced team name matching with flexible format support - generates multiple variations to match different OBA naming conventions across affiliates (January 2025)
- Implemented team classification system support - organizations can have multiple teams in same age division with different skill levels (AAA, AA, A, B, C, D, DS, HS) requiring proper affiliate and classification matching for accurate roster retrieval (January 2025)
- **Fixed critical affiliate detection issue** - Added complete affiliate mapping for all 21 OBA affiliates with proper numbers (e.g., London=0700, Windsor=2100, Sun Parlour=2111) preventing all imports from defaulting to Sun Parlour (January 2025)
- **Enhanced affiliate-specific team lists** - Different teams are now shown based on detected affiliate, ensuring London teams get London affiliate URLs and Sun Parlour teams get Sun Parlour URLs (January 2025)
- **Implemented organization-based roster import** - Replaced guessing approach with structured affiliate → organization → team selection flow, mapping organizations to their correct affiliates for accurate roster retrieval (January 2025)
- **Added hierarchical roster import UI** - Users now select affiliate, then organization, then specific team from a filtered list based on the tournament division, ensuring accurate team-to-affiliate mapping (January 2025)
- **Simplified roster import to auto-detect affiliates** - Removed need to know affiliate by showing all organizations across Ontario that have teams in the tournament's division (January 2025)
- **Fixed SPBA organizations not appearing** - Removed filter that was excluding Sun Parlour teams; added Forest Glade, Turtle Club, and 15+ more SPBA organizations (January 2025)
- **Expanded organization coverage** - Added complete organization mappings for all 18 active OBA affiliates including EBLO, HDBA, ICBA, NBBA, NCBA, SCBA, and WOBA (January 2025)
- **Dynamic team generation** - Updated get_organization_teams to automatically show all teams in matching divisions (e.g., "11U" shows "11U HS", "11U Rep", "11U AAA") (January 2025)
- **Fixed critical OBA URL issue** - Discovered that affiliate numbers in OBA URLs can be changed without affecting displayed team (e.g., /2111/team/500348 and /2106/team/500348 both show same team). Only the team ID matters for determining which team is shown (January 2025)
- **Implemented hardcoded team ID mapping** - Added correct team IDs for key organizations: LaSalle Turtle Club 11U = 500717 (not 500992), Forest Glade, London teams, etc. This ensures roster imports pull the correct team data regardless of URL affiliate number (July 2025)
- **Built comprehensive Team ID Scanner** - Created full OBA team discovery system that probes team IDs across Ontario to build database of all participating teams and their rosters, supporting the automated roster import system (July 2025)
- **Implemented intelligent team matching system** - Added smart roster import that analyzes existing tournament team names and suggests matching OBA teams based on name similarity and division, providing users with filtered options ranked by match quality when importing rosters (July 2025)
- **Fixed fake data issue with real OBA team database** - Replaced simulated team data with verified real OBA teams that can be manually confirmed on playoba.ca. Added special team name mappings (e.g., "London Tincaps" correctly matches "Essex Yellow Jackets") and proper keyword matching for authentic roster imports (July 2025)

## Key Architectural Decisions

### Monorepo Structure
- **Problem**: Managing shared code between frontend and backend
- **Solution**: Unified TypeScript configuration with shared schema
- **Benefits**: Type safety across client/server boundary, code reuse

### Database Migration (December 2024)
- **Problem**: Real-time tournament data updates and data persistence
- **Solution**: Switched from Firebase Firestore to PostgreSQL with Drizzle ORM
- **Benefits**: Better relational data handling, improved performance, SQL query capabilities

### Storage Abstraction
- **Problem**: Flexible data storage options
- **Solution**: Interface-based storage layer with PostgreSQL implementation
- **Benefits**: Easy testing, database migration flexibility, type-safe database operations

### Component-First UI
- **Problem**: Consistent, accessible user interface
- **Solution**: Radix UI primitives with shadcn/ui components
- **Benefits**: Accessibility compliance, consistent design system

### Development Experience
- **Problem**: Fast development iteration
- **Solution**: Vite with HMR, TSX execution, and Replit integration
- **Benefits**: Instant feedback, integrated debugging, cloud development