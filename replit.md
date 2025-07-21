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
  - Colors: Orange (#E55720) and Navy (#3A5998) from StyleMix Baseball website
  - Fonts: Oswald for headings, Roboto for body text
  - Typography: Uppercase headings with letter spacing for professional sports look
  - Background: Light gray (#F5F5F5) for subtle contrast
  - Navigation: Navy header with orange accent highlights

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
- **Storage Interface**: Abstracted storage layer with in-memory fallback
- **User Management**: Create, retrieve, and authenticate users
- **Session Handling**: Express session management

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