# Dugout Desk - Your Tournament Command Center

## Overview
Dugout Desk is a mobile-first tournament management application designed for baseball leagues in Ontario, specifically targeting the Ontario Baseball Association (OBA) and partner organizations. Its purpose is to provide real-time standings, score tracking, and playoff bracket management with a focus on speed and usability for coaches managing tournaments on mobile devices. The platform aims to streamline tournament operations, allowing users to "Get in, get it done, get back to the game."

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite
- **Timezone Support**: date-fns-tz for organization-specific timezone formatting
- **Theming**: Professional baseball aesthetic with Deep Navy, Field Green, and Clay Red. Typography uses Oswald for headings and Inter for body text.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: PostgreSQL session store
- **Development**: TSX for TypeScript execution

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database serverless
- **ORM**: Drizzle ORM
- **Session Storage**: PostgreSQL with connect-pg-simple
- **Migrations**: Drizzle Kit

### Key Architectural Decisions
- **Authentication System**: Replit Auth using OpenID Connect for secure and seamless user management.
- **Monorepo Structure**: Unified TypeScript configuration and shared schema for type safety and code reuse.
- **Database Choice**: PostgreSQL with Drizzle ORM for relational data handling and performance.
- **Storage Abstraction**: Interface-based storage layer for flexibility and testability.
- **Component-First UI**: Utilizes Radix UI and shadcn/ui for consistent, accessible UI.
- **Development Experience**: Fast iteration with Vite, HMR, TSX, and Replit integration.
- **Multi-Organization Support**: Dedicated `organizations` table allowing multiple baseball organizations to manage their tournaments on the platform with individual branding and settings.
- **Feature Flag System**: Database-backed feature flags with super admin and organization-level controls for granular feature management.
- **Role-Based Access Control**: `isAdmin` flag and `requireAdmin` middleware to restrict sensitive operations.
- **Timezone Management**: Organization-specific timezone settings for accurate date/time display using `date-fns-tz`.
- **Hostname-Based Routing**: Single deployment serves both www.dugoutdesk.ca (public storefront) and app.dugoutdesk.ca (admin app) with context-aware UI using `/api/context` endpoint and client-side fallback for resilience.

### Core Features & Design
- **Tournament Dashboard**: Central interface for tournament management, publicly accessible.
- **Standings Table**: Real-time standings with tie-breaker logic and pool-based seeding.
- **Admin Portal**: Comprehensive administrative functions including tournament creation, data import/export, game result editing, and access control.
- **Hierarchical Score Input**: Step-by-step score submission workflow.
- **Organization Settings**: Super admins can configure organization defaults like timezone and playoff formats.
- **Organization Admin Management**: Two-tier admin system with role-based access control.
- **Team Management**: Team editor with fields for name, division, city, coach, and integration with PlayOBA roster via a 6-digit team number.
- **Consolidated Schedule Editing**: All game schedule editing is centralized in the Admin Portal.
- **Location Integration**: Display of diamond GPS coordinates with Google Maps integration.
- **Roster Management**: Manual roster import system.
- **Public Homepage & Organization Detail Pages**: Publicly accessible pages showcasing organizations and their tournaments.
- **Tournament Creation with Organization Defaults**: Tournament creation form auto-populates playoff format, seeding pattern, colors, and logo from selected organization's defaults while allowing per-tournament customization.
- **Enhanced Admin Onboarding**: Admin request process captures complete organization details (name, logo, branding, timezone, defaults) for atomic organization creation upon approval with notification badges for super admins.
- **Cross-Pool Playoff Bracket View**: Dedicated bracket visualization for tournaments using cross_pool_4 seeding that displays pool standings (top 2 teams per pool A/B/C/D), quarterfinal matchups with seed labels (A1 vs C2, A2 vs C1, B1 vs D2, B2 vs D1), semifinals showing winner advancement, and finals.
- **Test Data Population**: One-click "Populate Test Data" button for tournaments with IDs containing 'test' or 'testing', creating 4 pools with 4 teams each and complete game schedules with innings data for tiebreaker validation.
- **Tournament Visibility System**: Three-tier visibility control (private, public, unlisted) enabling SaaS model with public tournament directory at /directory, public API endpoint at /api/public/tournaments, and access control that restricts private tournaments to authenticated users while allowing public discovery of tournaments marked as public.
- **Division-Aware Schedule Generation**: Enhanced schedule generator with division selector UI for tournaments with multiple age divisions (11U, 13U, 18U). Teams are filtered by division text field before pool distribution, preventing cross-division mixing. Division-specific messaging shows team counts, pool distribution, and success notifications per division. Backend validates divisionId and filters teams by matching t.division === division.name, with fallback to pool membership for already-assigned teams. Temporary pools (created during import) are filtered out to ensure users always start at the distribute step, with full navigation control between workflow steps.
- **Playoff Bracket Preview**: Visual preview component that displays playoff bracket structure before games are generated. For cross_pool_4 seeding, shows detailed matchup structure (A1 vs C2, A2 vs C1, B1 vs D2, B2 vs D1) through quarterfinals, semifinals, and finals. For other formats (top_8, top_6, top_4), displays format information and team count. Preview appears in the Playoffs tab when no playoff games exist, providing tournament organizers visibility into the bracket structure during pool play.
- **Draft Schedule Workflow**: Three-step schedule creation process (CSV import → manual pool assignment → draft generation → review → commit) that allows tournament organizers to review generated schedules before saving to database. Backend endpoints split: `/generate-schedule` returns draft games as JSON without persisting, `/commit-schedule` validates games (schema validation, tournament ownership, team/pool verification) and regenerates IDs server-side using nanoid for security before saving. Frontend displays draft games in scrollable review table showing game details (date/time, diamond, teams, pool), with clear commit/cancel controls. Prevents accidental schedule overwrites and allows iterative refinement before finalization.
- **Diamond Availability & Scheduling Constraints**: Organization-level field (diamond) management system with availability hours tracking and tournament-specific scheduling rules. Organizations define diamonds with names, locations, operating hours, and lighting capabilities. Tournament creators select available diamonds and configure constraints: minimum rest between games (default 30 minutes), extended rest between 2nd/3rd game of day (default 60 minutes), and maximum games per team per day (default 3). Schedule generator automatically assigns diamonds to games and validates all constraints, displaying violations with severity levels in the review UI. Server-side validation in commit endpoint re-checks all constraints to prevent API bypass, ensuring only valid schedules are persisted to database.
- **WordPress Calendar Integration (Forest Glade)**: Complete diamond booking system featuring iCal subscription import from WordPress Events Calendar (8-hour sync interval), external calendar events storage, unified calendar view displaying three event types (house league/orange, bookings/status-based, tournaments/indigo) with filtering by diamond and event type, two-tier approval workflow (select coordinator → diamond coordinator) with email/SMS notifications, admin UI for managing iCal feeds with diamond location mapping, manual sync controls, and automatic display of Forest Glade tournament games as calendar conflicts. Background sync job runs on server boot and every 8 hours, with ICS parser supporting line folding and timezone-safe date conversion using date-fns-tz.

## External Dependencies

- **Database**: `@neondatabase/serverless`
- **ORM**: `drizzle-orm`, `drizzle-zod`
- **UI Framework**: Radix UI, shadcn/ui
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: `date-fns`, `date-fns-tz`
- **Session Management**: `connect-pg-simple`, `express-session`
- **Authentication**: `openid-client`, `passport`, `memoizee`
- **Web Scraping**: Python-based service for OBA roster data