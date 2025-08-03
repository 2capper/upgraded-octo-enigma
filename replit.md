# Tournament Management System

## Overview
This is a full-stack tournament management system designed for the Forest Glade Falcons baseball organization. Its primary purpose is to provide real-time tournament management capabilities, including team registration, game scheduling, score tracking, standings calculation, and playoff bracket management. The system aims to streamline the complexities of running baseball tournaments, offering an intuitive platform for organizers and participants.

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
- **Monorepo Structure**: Unified TypeScript configuration and shared schema for type safety and code reuse across frontend and backend.
- **Database Choice**: Switched to PostgreSQL with Drizzle ORM for better relational data handling, performance, and SQL querying capabilities.
- **Storage Abstraction**: Interface-based storage layer allowing for flexible data storage options and easier testing.
- **Component-First UI**: Utilizes Radix UI primitives and shadcn/ui components for consistent, accessible UI.
- **Development Experience**: Fast iteration enabled by Vite with HMR, TSX execution, and Replit integration.

### Core Features & Design
- **Tournament Dashboard**: Main interface for tournament management.
- **Standings Table**: Real-time standings with tie-breaker logic, division toggle, and proper pool-based tournament seeding where pool winners rank 1-3 by RA/DIP followed by pool runners-up in positions 4-6.
- **Admin Portal**: Comprehensive administrative functions including tournament creation, data import/export, game result editing, and robust access control.
- **Hierarchical Score Input**: Step-by-step score submission workflow.
- **Authentication System**: Role-based authentication with bcrypt hashing, session management, and protected routes.
- **Theming**: Professional baseball styling with Forest Green and Yellow colors, Oswald and Roboto fonts, and uppercase headings.
- **Location Integration**: Display of diamond GPS coordinates for game venues with Google Maps integration.
- **Roster Management**: Automated roster import tool with fuzzy team name matching from playoba.ca, comprehensive OBA team discovery, and authentic roster scraping.

## External Dependencies

- **Database**: `@neondatabase/serverless` (PostgreSQL connection)
- **ORM**: `drizzle-orm`, `drizzle-zod`
- **UI Framework**: Radix UI, shadcn/ui
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: `date-fns`
- **Session Management**: `connect-pg-simple`
- **Authentication**: `bcrypt`, `express-session`
- **Web Scraping**: Python-based service for OBA roster data (utilizes `urllib.parse` for security)