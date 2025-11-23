# Dugout Desk - Your Tournament Command Center

## Overview
Dugout Desk is a mobile-first tournament management application for baseball leagues, specifically targeting the Ontario Baseball Association (OBA). Its core purpose is to provide real-time standings, score tracking, and playoff bracket management to streamline tournament operations for coaches using mobile devices. The platform aims to be a quick and efficient tool, allowing users to "Get in, get it done, get back to the game."

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite
- **Theming**: Professional baseball aesthetic (Deep Navy, Field Green, Clay Red) with Oswald for headings and Inter for body text.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: PostgreSQL session store
- **Development**: TSX for TypeScript execution

### Data Storage
- **Primary Database**: PostgreSQL via Neon Database serverless
- **ORM**: Drizzle ORM

### Key Architectural Decisions
- **Authentication**: Replit Auth using OpenID Connect.
- **Monorepo Structure**: Unified TypeScript configuration and shared schema.
- **Multi-Organization Support**: Dedicated `organizations` table for separate branding and settings.
- **Feature Flags**: Database-backed feature flags for granular control at super admin and organization levels.
- **Role-Based Access Control**: `isAdmin` flag and `requireAdmin` middleware.
- **Timezone Management**: Organization-specific timezone settings using `date-fns-tz`.
- **Hostname-Based Routing**: Single deployment serving public storefront (`www.dugoutdesk.ca`) and admin app (`app.dugoutdesk.ca`).
- **Unified Organization Admin Portal**: Modular admin portal at `/org/:orgId/admin` as the central hub for organization management, with features like Tournament Management, Diamond Booking, SMS, Weather, Team Management, Reports, and Settings, all controlled by feature flags.
- **Component-First UI**: Radix UI and shadcn/ui for consistent and accessible UI.

### Core Features & Design
- **Tournament Dashboard**: Central interface for managing tournaments.
- **Standings Table**: Real-time standings with tie-breaker logic.
- **Admin Portal**: Comprehensive functions including tournament creation, data import/export, game result editing, and access control.
- **Hierarchical Score Input**: Step-by-step score submission.
- **Organization Settings**: Configuration of organization defaults and admin management.
- **Team Management**: Editor with PlayOBA roster integration.
- **Consolidated Schedule Editing**: Centralized game schedule editing in the Admin Portal.
- **Location Integration**: Display of diamond GPS coordinates with Google Maps.
- **Roster Management**: Manual roster import system.
- **Public Pages**: Homepage and organization detail pages for public access.
- **Tournament Creation**: Auto-populates from organization defaults with per-tournament customization.
- **Enhanced Admin Onboarding**: Admin request process for organization creation and approval.
- **Cross-Pool Playoff Bracket View**: Visualization for complex playoff structures (e.g., cross_pool_4).
- **Test Data Population**: One-click generation of test data for tournaments.
- **Tournament Visibility System**: Three-tier control (private, public, unlisted) with a public directory.
- **Division-Aware Schedule Generation**: UI and backend support for scheduling across multiple age divisions.
- **Playoff Bracket Preview**: Visual preview of bracket structure before games are generated.
- **Playoff Slot Pre-Scheduling**: Admin interface to schedule playoff game times and diamonds in advance.
- **Draft Schedule Workflow**: Three-step process (import → assign → generate → review → commit) allowing review before saving.
- **Diamond Availability & Scheduling Constraints**: Organization-level field management with availability hours and constraints (rest between games, max games per team per day).
- **WordPress Calendar Integration**: iCal subscription import from WordPress Events Calendar for diamond booking.
- **Coordinator Management System**: Database-driven roles (Select, Diamond, UIC, Treasurer) for notifications.
- **Coach Invitation System**: Email-based invitation workflow with secure tokens for coaches to access booking features.
- **Booking Time Constraints**: Booking form enforces 30-minute intervals.
- **SMS Communications**: Twilio integration for organization admins to send bulk SMS to coaches.
- **Smart Concierge SMS Webhook**: Bidirectional SMS system that intelligently responds to inbound texts. When coaches text the organization's Twilio number, the system identifies them by phone lookup across coach/manager/assistant fields, auto-replies with a personalized tournament dashboard link (with `?chat=open` for future AI integration), and logs all messages in an admin inbox. Unknown numbers receive a configurable fallback message.
- **Weather Integration**: WeatherAPI.com for dynamic forecasts, player safety alerts, and a dedicated weather dashboard with configurable safety thresholds.
- **Weather Map Visualization**: Interactive Leaflet-based map displaying weather alerts across all diamond locations with severity-coded markers (red/orange/yellow) and detailed popups. Integrated as a tab view in the Weather Dashboard alongside the list view, with shared data and mobile-optimized design.
- **Field Status Management (Field Command V2.0)**: Real-time diamond status control system allowing admins to mark fields as Open, Closed, Delayed, or TBD with optional status messages. When a field status changes, admins are presented with affected games and can instantly send SMS alerts to all coaches (coach/manager/assistant contacts) with one click. Status updates are displayed publicly on game cards with color-coded badges (green/red/yellow/gray) and a Field Conditions section shows all tournament diamond statuses for maximum transparency.

## External Dependencies

- **Database**: `@neondatabase/serverless`
- **ORM**: `drizzle-orm`, `drizzle-zod`
- **UI Framework**: Radix UI, shadcn/ui
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: `date-fns`, `date-fns-tz`
- **Session Management**: `connect-pg-simple`, `express-session`
- **Authentication**: `openid-client`, `passport`, `memoizee`
- **SMS**: Twilio
- **Weather**: WeatherAPI.com
- **Maps**: Leaflet, React-Leaflet for interactive weather visualization
- **Web Scraping**: Python-based service for OBA roster data