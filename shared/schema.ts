import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, index, varchar, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { sql } from 'drizzle-orm';

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // Hashed password for email/password auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OBA Teams database for comprehensive team discovery and matching
export const obaTeams = pgTable("oba_teams", {
  id: serial("id").primaryKey(),
  teamId: text("team_id").notNull().unique(), // OBA team ID (e.g., "500718")
  teamName: text("team_name").notNull(), // Full team name (e.g., "11U HS Forest Glade")
  organization: text("organization"), // Organization name (e.g., "Forest Glade")
  division: text("division"), // Age division (e.g., "11U", "13U")
  level: text("level"), // Competition level (e.g., "HS", "Rep", "AAA")
  affiliate: text("affiliate"), // OBA affiliate (e.g., "SPBA", "SCBA")
  hasRoster: boolean("has_roster").notNull().default(false), // Whether roster data is available
  playerCount: integer("player_count").default(0), // Number of players on roster
  lastScanned: timestamp("last_scanned").notNull().defaultNow(), // When this team was last verified
  isActive: boolean("is_active").notNull().default(true), // Whether team is currently active
  rosterData: jsonb("roster_data"), // Cached roster data if available
});

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier (e.g., "forest-glade-falcons")
  description: text("description"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#22c55e"),
  secondaryColor: text("secondary_color").default("#ffffff"),
  websiteUrl: text("website_url"),
  contactEmail: text("contact_email"),
  adminEmail: text("admin_email"), // Primary admin email for welcome and notification emails
  stripeAccountId: text("stripe_account_id"), // For future payment processing
  timezone: text("timezone").default("America/Toronto"), // IANA timezone identifier
  defaultPrimaryColor: text("default_primary_color").default("#22c55e"), // Default color for new tournaments
  defaultSecondaryColor: text("default_secondary_color").default("#ffffff"), // Default secondary color for new tournaments
  defaultPlayoffFormat: text("default_playoff_format").default("top_6"), // Default playoff format for new tournaments
  defaultSeedingPattern: text("default_seeding_pattern").default("standard"), // Default seeding pattern for new tournaments
  calendarSubscriptionToken: text("calendar_subscription_token").unique(), // Unique token for calendar subscription URL
  hasDiamondBooking: boolean("has_diamond_booking").notNull().default(false), // Enable diamond booking module for this organization
  isClaimed: boolean("is_claimed").notNull().default(false), // Whether this pre-seeded org has been claimed by an admin
  claimToken: text("claim_token"), // Unique verification token for claiming (optional, for future email verification)
  city: text("city"), // City location for the organization
  address: text("address"), // Street address for the organization
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const diamonds = pgTable("diamonds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  availableStartTime: text("available_start_time").notNull().default("08:00"),
  availableEndTime: text("available_end_time").notNull().default("20:00"),
  hasLights: boolean("has_lights").notNull().default(false),
  status: text("status").notNull().default("open"), // "open" | "closed" | "delayed" | "tbd"
  statusMessage: text("status_message"), // Custom message about field status (e.g., "Under water - evaluating at 10 AM")
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const organizationIcalFeeds = pgTable("organization_ical_feeds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Baseball House League" | "Softball House League" | "13U Division"
  feedUrl: text("feed_url").notNull(), // WordPress Events Calendar iCal feed URL
  diamondMapping: jsonb("diamond_mapping"), // Maps WordPress calendar diamond names to Dugout Desk diamond IDs: { "Diamond 1": "uuid-here", "Diamond 2": "uuid-here" }
  lastSyncAt: timestamp("last_sync_at"), // Last successful sync timestamp
  lastSyncStatus: text("last_sync_status"), // "success" | "error"
  lastSyncError: text("last_sync_error"), // Error message if sync failed
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Organization admins junction table
export const organizationAdmins = pgTable("organization_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("admin"), // "admin" | "owner" - for future role expansion
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Organization feature flags junction table
export const organizationFeatureFlags = pgTable("organization_feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  featureFlagId: varchar("feature_flag_id").notNull().references(() => featureFlags.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("org_feature_flags_uniq_idx").on(table.organizationId, table.featureFlagId),
]);

export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  type: text("type").notNull().default("pool_play"), // "single_elimination" | "double_elimination" | "pool_play"
  numberOfTeams: integer("number_of_teams").default(8),
  numberOfPools: integer("number_of_pools").default(2),
  numberOfPlayoffTeams: integer("number_of_playoff_teams").default(6), // DEPRECATED: Use playoffFormat instead
  playoffFormat: text("playoff_format"), // "top_4" | "top_6" | "top_8" | "all_seeded" | "championship_consolation" | "double_elim_12" | etc
  seedingPattern: text("seeding_pattern"), // "standard" | "cross_pool_4" | "cross_pool_3" | "custom" | etc - Determines matchup structure for playoffs
  showTiebreakers: boolean("show_tiebreakers").notNull().default(true),
  customName: text("custom_name"), // Custom display name for tournament branding
  primaryColor: text("primary_color").default("#22c55e"), // Primary theme color (default: green)
  secondaryColor: text("secondary_color").default("#ffffff"), // Secondary theme color (default: white)
  logoUrl: text("logo_url"), // URL to custom tournament logo
  visibility: text("visibility", { enum: ["private", "public", "unlisted"] }).notNull().default("private"), // Controls who can view the tournament
  minGameGuarantee: integer("min_game_guarantee"), // Minimum number of games each team should play (pool play)
  numberOfDiamonds: integer("number_of_diamonds"), // Number of available diamonds/fields
  diamondDetails: jsonb("diamond_details"), // Array of { venue: string, subVenue: string } for each diamond
  selectedDiamondIds: text("selected_diamond_ids").array(), // Array of diamond IDs available for this tournament
  minRestMinutes: integer("min_rest_minutes").notNull().default(30), // Minimum rest time between games for same team
  restBetween2nd3rdGame: integer("rest_between_2nd_3rd_game").notNull().default(60), // Rest time between 2nd and 3rd game of the day
  maxGamesPerDay: integer("max_games_per_day").notNull().default(3), // Maximum games a team can play in one day
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ageDivisions = pgTable("age_divisions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  defaultGameDuration: integer("default_game_duration").notNull().default(90), // Default game duration in minutes for this division
});

export const pools = pgTable("pools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  ageDivisionId: text("age_division_id").notNull().references(() => ageDivisions.id, { onDelete: "cascade" }),
});

export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  division: text("division"),
  city: text("city"),
  coach: text("coach"), // Legacy field - kept for backwards compatibility
  coachFirstName: text("coach_first_name"),
  coachLastName: text("coach_last_name"),
  coachEmail: text("coach_email"),
  coachPhone: text("coach_phone"), // Normalized E.164 format phone number (+15551234567)
  phone: text("phone"),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  poolId: text("pool_id").references(() => pools.id, { onDelete: "set null" }),
  rosterLink: text("roster_link"),
  teamNumber: varchar("team_number", { length: 10 }), // 6-digit OBA team number for roster URL and roster link generation
  pitchCountAppName: text("pitch_count_app_name"),
  pitchCountName: text("pitch_count_name"),
  gameChangerName: text("game_changer_name"),
  rosterData: text("roster_data"), // JSON string of roster players
  registrationStatus: text("registration_status"), // "Registered" | "Approved" | "Waitlisted" - from CSV import
  paymentStatus: text("payment_status"), // Payment status from registration CSV
  isPlaceholder: boolean("is_placeholder").notNull().default(false), // True for seed label teams that will be replaced after pool play
  managerName: text("manager_name"), // Team manager name added via coach self-service form
  managerPhone: text("manager_phone"), // Team manager phone (normalized E.164 format)
  assistantName: text("assistant_name"), // Assistant coach name added via coach self-service form
  assistantPhone: text("assistant_phone"), // Assistant coach phone (normalized E.164 format)
  managementToken: text("management_token").unique(), // Secure token for coach to update team staff contacts
  schedulingRequests: text("scheduling_requests"), // Special scheduling requests (e.g., "Can't play before 11 AM Saturday")
  willingToPlayExtra: boolean("willing_to_play_extra").notNull().default(false), // Team is willing to play extra games if slots open
});

export const matchups = pgTable("matchups", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  poolId: text("pool_id").notNull().references(() => pools.id, { onDelete: "cascade" }),
  homeTeamId: text("home_team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  awayTeamId: text("away_team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
}, (table) => ({
  // Unique constraint to prevent duplicate matchups
  uniqueMatchup: unique().on(table.tournamentId, table.poolId, table.homeTeamId, table.awayTeamId),
}));

export const games = pgTable("games", {
  id: text("id").primaryKey(),
  homeTeamId: text("home_team_id").references(() => teams.id, { onDelete: "cascade" }),
  awayTeamId: text("away_team_id").references(() => teams.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("scheduled"), // "scheduled" | "completed"
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  homeInningsBatted: decimal("home_innings_batted"),
  awayInningsBatted: decimal("away_innings_batted"),
  homeInningScores: integer("home_inning_scores").array(),
  awayInningScores: integer("away_inning_scores").array(),
  homeInningsDefense: integer("home_innings_defense").array(),
  awayInningsDefense: integer("away_innings_defense").array(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  poolId: text("pool_id").notNull().references(() => pools.id, { onDelete: "cascade" }),
  forfeitStatus: text("forfeit_status").notNull().default("none"), // "none" | "home" | "away"
  date: text("date").notNull(),
  time: text("time").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(90), // Game duration in minutes (default 1.5 hours)
  location: text("location").notNull(),
  subVenue: text("sub_venue"),
  diamondId: varchar("diamond_id").references(() => diamonds.id, { onDelete: "set null" }), // Assigned diamond/field
  matchupId: text("matchup_id"), // Links game to unplaced matchup for drag-and-drop schedule builder
  isPlayoff: boolean("is_playoff").notNull().default(false),
  // Playoff bracket fields
  playoffRound: integer("playoff_round"),
  playoffGameNumber: integer("playoff_game_number"),
  playoffBracket: text("playoff_bracket"), // 'winners' | 'losers' | 'championship'
  team1Source: jsonb("team1_source"), // { gameNumber: number, position: 'winner' | 'loser' }
  team2Source: jsonb("team2_source"), // { gameNumber: number, position: 'winner' | 'loser' }
  weatherStatus: text("weather_status").default("normal"), // "normal" | "watch" | "warning" | "cancelled" - Weather safety status
});

// Audit log table for tracking score changes and administrative actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // "score_update" | "game_create" | "game_delete" | etc
  entityType: text("entity_type").notNull(), // "game" | "team" | "tournament"
  entityId: text("entity_id").notNull(),
  oldValues: jsonb("old_values"), // Previous values before change
  newValues: jsonb("new_values"), // New values after change
  metadata: jsonb("metadata"), // Additional context (IP, user agent, etc.)
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Admin request table for user admin access requests with organization details
export const adminRequests = pgTable("admin_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  userEmail: varchar("user_email").notNull(),
  userName: varchar("user_name").notNull(),
  message: text("message").notNull(),
  
  // Organization details to create upon approval
  organizationName: text("organization_name").notNull(),
  organizationSlug: text("organization_slug").notNull(),
  organizationDescription: text("organization_description"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#22c55e"),
  secondaryColor: text("secondary_color").default("#ffffff"),
  websiteUrl: text("website_url"),
  contactEmail: text("contact_email"),
  timezone: text("timezone").default("America/Toronto"),
  defaultPlayoffFormat: text("default_playoff_format").default("top_6"),
  defaultSeedingPattern: text("default_seeding_pattern").default("standard"),
  
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdOrganizationId: varchar("created_organization_id").references(() => organizations.id), // Set upon approval
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Communication templates for reusable message templates
export const communicationTemplates = pgTable("communication_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Weather Delay" | "Field Change" | "Game Cancelled"
  content: text("content").notNull(), // Template message with optional variables like {team_name}, {game_time}, {diamond}
  category: text("category"), // "weather" | "schedule" | "general" - for filtering in UI
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tournament messages for tracking message history
export const tournamentMessages = pgTable("tournament_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  sentBy: varchar("sent_by").notNull().references(() => users.id), // User who sent the message
  content: text("content").notNull(), // The message content that was sent
  recipientType: text("recipient_type").notNull(), // "coaches_only" | "all_staff" - indicates who received the message
  recipientCount: integer("recipient_count").notNull(), // Number of recipients who received the message
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Feature flags table for controlling feature availability
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  featureKey: varchar("feature_key", { length: 100 }).notNull().unique(), // "tournament_registration" | "tournament_comms" | "schedule_builder"
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  icon: text("icon"), // Lucide icon name for UI display
  comingSoonText: text("coming_soon_text"), // Custom text for coming soon page
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Registration periods for managing open/closed registration windows
export const registrationPeriods = pgTable("registration_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Spring 2025 House League"
  description: text("description"),
  programType: text("program_type").notNull(), // "house_league" | "select" | "tournament"
  sport: text("sport").notNull(), // "baseball" | "softball"
  divisions: text("divisions").array(), // ["11U", "13U", "15U"]
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  earlyBirdDate: timestamp("early_bird_date"),
  earlyBirdPrice: decimal("early_bird_price", { precision: 10, scale: 2 }),
  regularPrice: decimal("regular_price", { precision: 10, scale: 2 }).notNull(),
  maxCapacity: integer("max_capacity"),
  currentCount: integer("current_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  allowWaitlist: boolean("allow_waitlist").notNull().default(true),
  multiFamilyDiscount: decimal("multi_family_discount", { precision: 5, scale: 2 }), // Percentage discount
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Player registrations for house league and select programs
export const playerRegistrations = pgTable("player_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registrationPeriodId: varchar("registration_period_id").notNull().references(() => registrationPeriods.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Player information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  gender: text("gender"),
  division: text("division").notNull(), // "11U", "13U", etc.
  shirtSize: text("shirt_size").notNull(), // "YS", "YM", "YL", "AS", "AM", "AL", etc.
  
  // Parent/Guardian information
  parentFirstName: text("parent_first_name").notNull(),
  parentLastName: text("parent_last_name").notNull(),
  parentEmail: text("parent_email").notNull(),
  parentPhone: text("parent_phone").notNull(),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  
  // Medical information
  medicalConditions: text("medical_conditions"),
  allergies: text("allergies"),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  
  // Registration details
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected" | "waitlisted"
  paymentStatus: text("payment_status").notNull().default("unpaid"), // "unpaid" | "paid" | "refunded"
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  discountApplied: decimal("discount_applied", { precision: 10, scale: 2 }),
  
  // Draft assignment (for house league)
  draftPoolId: varchar("draft_pool_id").references(() => draftPools.id),
  assignedTeam: text("assigned_team"),
  
  // Uniform tracking
  uniformOrdered: boolean("uniform_ordered").notNull().default(false),
  uniformReceived: boolean("uniform_received").notNull().default(false),
  
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Team registrations for tournaments
export const teamRegistrations = pgTable("team_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registrationPeriodId: varchar("registration_period_id").references(() => registrationPeriods.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  tournamentId: text("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
  
  // Team information
  teamName: text("team_name").notNull(),
  division: text("division").notNull(),
  city: text("city"),
  
  // Coach information
  coachFirstName: text("coach_first_name").notNull(),
  coachLastName: text("coach_last_name").notNull(),
  coachEmail: text("coach_email").notNull(),
  coachPhone: text("coach_phone").notNull(),
  
  // Team identifiers
  obaNumber: varchar("oba_number", { length: 10 }),
  pitchCountAppNumber: text("pitch_count_app_number"),
  
  // Roster
  rosterData: jsonb("roster_data"), // Array of player objects
  
  // Registration details
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
  paymentStatus: text("payment_status").notNull().default("unpaid"), // "unpaid" | "paid" | "refunded"
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  
  // Link to created tournament team
  createdTeamId: text("created_team_id").references(() => teams.id, { onDelete: "set null" }),
  
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Payment records for all registrations
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Link to registration (either player or team)
  playerRegistrationId: varchar("player_registration_id").references(() => playerRegistrations.id, { onDelete: "cascade" }),
  teamRegistrationId: varchar("team_registration_id").references(() => teamRegistrations.id, { onDelete: "cascade" }),
  
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("CAD"),
  paymentMethod: text("payment_method").notNull(), // "stripe" | "paypal" | "interac"
  paymentProvider: text("payment_provider"), // "stripe" | "paypal"
  
  // Payment provider IDs
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paypalOrderId: text("paypal_order_id"),
  
  // Payment status
  status: text("status").notNull().default("pending"), // "pending" | "completed" | "failed" | "refunded"
  
  // Metadata
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Waitlist for full registration periods
export const waitlists = pgTable("waitlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registrationPeriodId: varchar("registration_period_id").notNull().references(() => registrationPeriods.id, { onDelete: "cascade" }),
  
  // Waitlist entry details
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  parentEmail: text("parent_email").notNull(),
  parentPhone: text("parent_phone").notNull(),
  division: text("division").notNull(),
  
  // Waitlist status
  status: text("status").notNull().default("active"), // "active" | "notified" | "registered" | "expired"
  position: integer("position").notNull(), // Position in waitlist
  notifiedAt: timestamp("notified_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Draft pools for organizing house league players by division
export const draftPools = pgTable("draft_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "2025 Spring 11U Draft"
  division: text("division").notNull(), // "11U", "13U", etc.
  sport: text("sport").notNull(), // "baseball" | "softball"
  season: text("season").notNull(), // "Spring 2025"
  
  // Draft settings
  numberOfTeams: integer("number_of_teams").notNull(),
  playersPerTeam: integer("players_per_team"),
  draftDate: timestamp("draft_date"),
  status: text("status").notNull().default("open"), // "open" | "in_progress" | "completed"
  
  // Draft order (team coach IDs in draft order)
  draftOrder: text("draft_order").array(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Communication messages log
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  tournamentId: text("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
  
  // Message details
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  messageType: text("message_type").notNull(), // "email" | "sms"
  
  // Recipients
  recipientType: text("recipient_type").notNull(), // "all" | "division" | "team" | "individual"
  recipientDivision: text("recipient_division"),
  recipientTeamId: text("recipient_team_id").references(() => teams.id, { onDelete: "set null" }),
  recipientEmails: text("recipient_emails").array(),
  recipientPhones: text("recipient_phones").array(),
  
  // Delivery status
  status: text("status").notNull().default("draft"), // "draft" | "sending" | "sent" | "failed"
  sentCount: integer("sent_count").default(0),
  failedCount: integer("failed_count").default(0),
  
  // Template used
  templateName: text("template_name"),
  
  // Metadata
  sendgridMessageId: text("sendgrid_message_id"),
  twilioMessageIds: text("twilio_message_ids").array(),
  
  sentBy: varchar("sent_by").notNull().references(() => users.id),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================
// FOREST GLADE BOOKING SYSTEM TABLES
// =============================================

// House league teams for Forest Glade organization
export const houseLeagueTeams = pgTable("house_league_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Team details
  name: text("name").notNull(),
  division: text("division").notNull(), // "9U" | "11U" | "13U" | "15U" | "18U" | "Senior Mens" | "T-Ball"
  
  // Coach information
  coachFirstName: text("coach_first_name"),
  coachLastName: text("coach_last_name"),
  coachEmail: text("coach_email"),
  coachPhone: text("coach_phone"),
  coachUserId: varchar("coach_user_id").references(() => users.id, { onDelete: "set null" }),
  
  // External data sync
  externalTeamId: text("external_team_id"), // ID from Forest Glade website
  lastSyncedAt: timestamp("last_synced_at"),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  // Calendar subscription
  calendarSubscriptionToken: text("calendar_subscription_token").unique(), // Unique token for team calendar subscription URL
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Booking requests for diamonds, practices, and batting cage
export const bookingRequests = pgTable("booking_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  houseLeagueTeamId: varchar("house_league_team_id").notNull().references(() => houseLeagueTeams.id, { onDelete: "cascade" }),
  
  // Booking details
  bookingType: text("booking_type").notNull(), // "game" | "practice" | "batting_cage"
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  
  // Diamond/facility
  diamondId: varchar("diamond_id").references(() => diamonds.id, { onDelete: "set null" }),
  requestedDiamondName: text("requested_diamond_name"), // Fallback if diamond not in system
  
  // Opponent (for games)
  opponentTeamId: varchar("opponent_team_id").references(() => houseLeagueTeams.id, { onDelete: "set null" }),
  opponentName: text("opponent_name"), // External opponent
  
  // Game details
  requiresUmpire: boolean("requires_umpire").notNull().default(false),
  
  // Notes
  notes: text("notes"),
  
  // Workflow state
  status: text("status").notNull().default("draft"), // "draft" | "submitted" | "select_coordinator_approved" | "diamond_coordinator_approved" | "confirmed" | "declined" | "cancelled"
  
  // Tracking
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  confirmedAt: timestamp("confirmed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Approval workflow audit trail
export const bookingApprovals = pgTable("booking_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: varchar("booking_request_id").notNull().references(() => bookingRequests.id, { onDelete: "cascade" }),
  
  // Approval details
  approverRole: text("approver_role").notNull(), // "select_coordinator" | "diamond_coordinator"
  approverId: varchar("approver_id").notNull().references(() => users.id),
  decision: text("decision").notNull(), // "approved" | "declined"
  
  // Feedback
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Organization coordinators (Select, Diamond, UIC, Treasurer)
export const organizationCoordinators = pgTable("organization_coordinators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Coordinator role and contact
  role: text("role").notNull(), // "select_coordinator" | "diamond_coordinator" | "uic" | "treasurer"
  email: text("email").notNull(),
  phone: text("phone"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  
  // Link to user account (optional - coordinator may not have an account yet)
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("org_coordinator_role_idx").on(table.organizationId, table.role),
]);

// Coach invitations for accessing booking system
export const coachInvitations = pgTable("coach_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Invitation details
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // "pending" | "accepted" | "revoked"
  
  // Team associations (coach can be associated with multiple teams)
  teamIds: text("team_ids").array().notNull().default(sql`'{}'::text[]`),
  
  // Acceptance tracking
  acceptedAt: timestamp("accepted_at"),
  acceptedByUserId: varchar("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Metadata
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Organization Twilio settings for SMS communications
export const organizationTwilioSettings = pgTable("organization_twilio_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Twilio credentials (stored securely)
  accountSid: text("account_sid").notNull(),
  authToken: text("auth_token").notNull(), // Should be encrypted in production
  phoneNumber: text("phone_number").notNull(), // Twilio phone number in E.164 format
  
  // Status and limits
  isEnabled: boolean("is_enabled").notNull().default(true),
  dailyLimit: integer("daily_limit").notNull().default(100), // Max messages per day
  rateLimit: integer("rate_limit").notNull().default(100), // Max messages per 15 minutes
  
  // Auto-reply message for inbound SMS (Smart Concierge fallback)
  autoReplyMessage: text("auto_reply_message").default("This is an automated alert system. Please contact your Tournament Director directly."),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Outbound SMS message log for tracking and auditing
export const outboundSmsMessages = pgTable("outbound_sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  tournamentId: text("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
  
  // Message details
  recipientPhone: text("recipient_phone").notNull(), // E.164 format
  recipientName: text("recipient_name"), // Coach name for display
  messageBody: text("message_body").notNull(),
  
  // Delivery tracking
  status: text("status").notNull().default("pending"), // "pending" | "sent" | "delivered" | "failed" | "undelivered"
  twilioMessageSid: text("twilio_message_sid"), // Twilio's unique message ID
  errorCode: text("error_code"), // Twilio error code if failed
  errorMessage: text("error_message"), // Error description
  
  // Metadata
  sentBy: varchar("sent_by").notNull().references(() => users.id), // Admin who sent the message
  characterCount: integer("character_count").notNull(),
  segmentCount: integer("segment_count").notNull().default(1), // SMS segments (160 chars each)
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Inbound SMS message log for Smart Concierge webhook (admin inbox)
export const inboundSmsMessages = pgTable("inbound_sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }), // Linked if org is identified
  
  // Message details
  fromNumber: text("from_number").notNull(), // Sender's phone in E.164 format
  toNumber: text("to_number").notNull(), // Twilio number that received the message
  messageBody: text("message_body").notNull(),
  
  // Smart Context (filled if we identify the sender)
  matchedTeamId: text("matched_team_id").references(() => teams.id, { onDelete: "set null" }),
  matchedTournamentId: text("matched_tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
  matchedRole: text("matched_role"), // "coach" | "manager" | "assistant" - which role matched
  
  // Admin inbox management
  isRead: boolean("is_read").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Weather API settings for organizations
export const organizationWeatherSettings = pgTable("organization_weather_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique().references(() => organizations.id, { onDelete: "cascade" }),
  
  // WeatherAPI.com credentials
  apiKey: text("api_key").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  
  // Alert thresholds (baseball safety guidelines)
  lightningRadiusMiles: integer("lightning_radius_miles").notNull().default(10), // Stop play when lightning within this radius
  heatIndexThresholdF: integer("heat_index_threshold_f").notNull().default(94), // Heat illness risk threshold
  windSpeedThresholdMph: integer("wind_speed_threshold_mph").notNull().default(25), // High wind alert
  precipitationThresholdPct: integer("precipitation_threshold_pct").notNull().default(70), // Rain probability alert
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Weather forecast cache for games
export const weatherForecasts = pgTable("weather_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Location (from game's diamond)
  latitude: decimal("latitude").notNull(),
  longitude: decimal("longitude").notNull(),
  
  // Forecast data (for game time)
  forecastTime: timestamp("forecast_time").notNull(), // When the forecast is for
  temperatureF: decimal("temperature_f"),
  feelsLikeF: decimal("feels_like_f"),
  heatIndexF: decimal("heat_index_f"),
  precipitationProbability: integer("precipitation_probability"), // 0-100%
  precipitationInches: decimal("precipitation_inches"),
  windSpeedMph: decimal("wind_speed_mph"),
  windGustMph: decimal("wind_gust_mph"),
  humidity: integer("humidity"), // 0-100%
  uvIndex: decimal("uv_index"),
  visibility: decimal("visibility_miles"),
  condition: text("condition"), // "Sunny" | "Cloudy" | "Rain" | etc
  conditionIcon: text("condition_icon"), // WeatherAPI icon code
  
  // Safety alerts
  hasLightningAlert: boolean("has_lightning_alert").notNull().default(false),
  hasHeatAlert: boolean("has_heat_alert").notNull().default(false),
  hasWindAlert: boolean("has_wind_alert").notNull().default(false),
  hasPrecipitationAlert: boolean("has_precipitation_alert").notNull().default(false),
  hasSevereWeatherAlert: boolean("has_severe_weather_alert").notNull().default(false),
  alertMessage: text("alert_message"), // Combined alert text for display
  
  // Raw API response for debugging
  rawResponse: jsonb("raw_response"),
  
  // Fetch tracking
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("weather_forecasts_game_idx").on(table.gameId),
  index("weather_forecasts_forecast_time_idx").on(table.forecastTime),
]);

// Admin invitations for adding organization admins
export const adminInvitations = pgTable("admin_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Invitation details
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // "pending" | "accepted" | "revoked"
  
  // Acceptance tracking
  acceptedAt: timestamp("accepted_at"),
  acceptedByUserId: varchar("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Metadata
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Diamond access restrictions by division
export const diamondRestrictions = pgTable("diamond_restrictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Restriction details
  division: text("division").notNull(), // "15U" | "18U" | etc
  allowedDiamonds: text("allowed_diamonds").array().notNull(), // ["TWF", "BAF"] for 15U/18U
  
  // Metadata
  reason: text("reason"), // "Diamond size requirements"
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("diamond_restriction_org_division_idx").on(table.organizationId, table.division),
]);

// Notification log for all email and SMS communications
export const notificationLog = pgTable("notification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull().default("organization"), // "system" | "organization"
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  bookingRequestId: varchar("booking_request_id").references(() => bookingRequests.id, { onDelete: "cascade" }),
  
  // Notification details
  notificationType: text("notification_type").notNull(), // "booking_submitted" | "approval_requested" | "approved" | "declined" | "uic_notification" | "password_reset"
  channel: text("channel").notNull(), // "email" | "sms"
  
  // Recipient
  recipientUserId: varchar("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  
  // Content
  subject: text("subject"),
  body: text("body").notNull(),
  
  // Delivery status
  status: text("status").notNull().default("pending"), // "pending" | "sent" | "failed"
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  
  // Provider tracking
  providerMessageId: text("provider_message_id"), // Twilio or SendGrid message ID
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// External calendar events synced from WordPress Events Calendar
export const externalCalendarEvents = pgTable("external_calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  icalFeedId: varchar("ical_feed_id").notNull().references(() => organizationIcalFeeds.id, { onDelete: "cascade" }),
  
  // Event details from WordPress
  externalEventId: text("external_event_id").notNull(), // UID from iCal feed
  title: text("title").notNull(),
  description: text("description"),
  
  // Timing
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:mm
  endDate: text("end_date").notNull(),
  endTime: text("end_time").notNull(),
  
  // Location/Diamond
  diamondId: varchar("diamond_id").references(() => diamonds.id, { onDelete: "set null" }), // Mapped diamond
  rawLocation: text("raw_location"), // Original location text from WordPress
  
  // Metadata
  division: text("division"), // Parsed from event title/description
  teamName: text("team_name"), // Parsed team name if available
  
  // Sync tracking
  lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("external_event_ical_uid_idx").on(table.icalFeedId, table.externalEventId),
]);

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  tournaments: many(tournaments),
  admins: many(organizationAdmins),
  diamonds: many(diamonds),
}));

export const diamondsRelations = relations(diamonds, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [diamonds.organizationId],
    references: [organizations.id],
  }),
  games: many(games),
}));

export const organizationAdminsRelations = relations(organizationAdmins, ({ one }) => ({
  user: one(users, {
    fields: [organizationAdmins.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationAdmins.organizationId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  organizationAdmins: many(organizationAdmins),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tournaments.organizationId],
    references: [organizations.id],
  }),
  ageDivisions: many(ageDivisions),
  pools: many(pools),
  teams: many(teams),
  games: many(games),
}));

export const ageDivisionsRelations = relations(ageDivisions, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [ageDivisions.tournamentId],
    references: [tournaments.id],
  }),
  pools: many(pools),
}));

export const poolsRelations = relations(pools, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [pools.tournamentId],
    references: [tournaments.id],
  }),
  ageDivision: one(ageDivisions, {
    fields: [pools.ageDivisionId],
    references: [ageDivisions.id],
  }),
  teams: many(teams),
  games: many(games),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [teams.tournamentId],
    references: [tournaments.id],
  }),
  pool: one(pools, {
    fields: [teams.poolId],
    references: [pools.id],
  }),
  homeGames: many(games, { relationName: "homeTeamGames" }),
  awayGames: many(games, { relationName: "awayTeamGames" }),
}));

export const gamesRelations = relations(games, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [games.tournamentId],
    references: [tournaments.id],
  }),
  pool: one(pools, {
    fields: [games.poolId],
    references: [pools.id],
  }),
  homeTeam: one(teams, {
    fields: [games.homeTeamId],
    references: [teams.id],
    relationName: "homeTeamGames",
  }),
  awayTeam: one(teams, {
    fields: [games.awayTeamId],
    references: [teams.id],
    relationName: "awayTeamGames",
  }),
  diamond: one(diamonds, {
    fields: [games.diamondId],
    references: [diamonds.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiamondSchema = createInsertSchema(diamonds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTournamentSchema = createInsertSchema(tournaments).omit({
  createdAt: true,
});

export const insertAgeDivisionSchema = createInsertSchema(ageDivisions);
export const insertPoolSchema = createInsertSchema(pools);
export const insertTeamSchema = createInsertSchema(teams);
export const insertMatchupSchema = createInsertSchema(matchups);
export const insertGameSchema = createInsertSchema(games);
export const insertObaTeamSchema = createInsertSchema(obaTeams).omit({
  id: true,
  lastScanned: true,
});
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});
export const insertAdminRequestSchema = createInsertSchema(adminRequests).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});
export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationAdminSchema = createInsertSchema(organizationAdmins).omit({
  id: true,
  createdAt: true,
});

export const insertOrganizationFeatureFlagSchema = createInsertSchema(organizationFeatureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRegistrationPeriodSchema = createInsertSchema(registrationPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlayerRegistrationSchema = createInsertSchema(playerRegistrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
});

export const insertTeamRegistrationSchema = createInsertSchema(teamRegistrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWaitlistSchema = createInsertSchema(waitlists).omit({
  id: true,
  createdAt: true,
});

export const insertDraftPoolSchema = createInsertSchema(draftPools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertHouseLeagueTeamSchema = createInsertSchema(houseLeagueTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationIcalFeedSchema = createInsertSchema(organizationIcalFeeds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExternalCalendarEventSchema = createInsertSchema(externalCalendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingRequestSchema = createInsertSchema(bookingRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingApprovalSchema = createInsertSchema(bookingApprovals).omit({
  id: true,
  createdAt: true,
});

export const insertDiamondRestrictionSchema = createInsertSchema(diamondRestrictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationLogSchema = createInsertSchema(notificationLog).omit({
  id: true,
  createdAt: true,
});

export const insertOrganizationCoordinatorSchema = createInsertSchema(organizationCoordinators).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCoachInvitationSchema = createInsertSchema(coachInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminInvitationSchema = createInsertSchema(adminInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Game update validation schema with strict score validation
export const gameUpdateSchema = insertGameSchema.partial().extend({
  homeScore: z.number().int().min(0).max(50).optional().nullable(),
  awayScore: z.number().int().min(0).max(50).optional().nullable(),
  homeInningsBatted: z.number().min(0).max(20).optional().nullable(),
  awayInningsBatted: z.number().min(0).max(20).optional().nullable(),
  forfeitStatus: z.enum(["none", "home", "away"]).optional(),
  status: z.enum(["scheduled", "completed"]).optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  subVenue: z.string().optional().nullable(),
});

// Enhanced tournament creation schema with tournament configuration
export const tournamentCreationSchema = insertTournamentSchema.extend({
  organizationId: z.string().min(1, "Organization is required"),
  type: z.enum(["single_elimination", "double_elimination", "pool_play"]).default("pool_play"),
  numberOfTeams: z.number().int().min(4).max(64).default(8),
  numberOfPools: z.number().int().min(1).max(8).default(2),
  playoffFormat: z.string().optional(), // "top_4" | "top_6" | "top_8" | "all_seeded" | "championship_consolation" | "double_elim_12" | etc
  showTiebreakers: z.boolean().default(true),
  customName: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#22c55e"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#ffffff"),
  logoUrl: z.string().url().max(2000).optional().or(z.literal('')),
  minGameGuarantee: z.number().int().min(1).max(20).optional(),
  selectedDiamondIds: z.array(z.string()).optional(),
  minRestMinutes: z.number().int().min(0).max(240).default(30),
  restBetween2nd3rdGame: z.number().int().min(0).max(240).default(60),
  maxGamesPerDay: z.number().int().min(1).max(5).default(3),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type Diamond = typeof diamonds.$inferSelect;
export type InsertDiamond = z.infer<typeof insertDiamondSchema>;

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;

export type AgeDivision = typeof ageDivisions.$inferSelect;
export type InsertAgeDivision = z.infer<typeof insertAgeDivisionSchema>;

export type Pool = typeof pools.$inferSelect;
export type InsertPool = z.infer<typeof insertPoolSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type Matchup = typeof matchups.$inferSelect;
export type InsertMatchup = z.infer<typeof insertMatchupSchema>;

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export type ObaTeam = typeof obaTeams.$inferSelect;
export type InsertObaTeam = z.infer<typeof insertObaTeamSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type GameUpdate = z.infer<typeof gameUpdateSchema>;
export type TournamentCreation = z.infer<typeof tournamentCreationSchema>;

export type AdminRequest = typeof adminRequests.$inferSelect;
export type InsertAdminRequest = z.infer<typeof insertAdminRequestSchema>;

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

export type OrganizationAdmin = typeof organizationAdmins.$inferSelect;
export type InsertOrganizationAdmin = z.infer<typeof insertOrganizationAdminSchema>;

export type OrganizationFeatureFlag = typeof organizationFeatureFlags.$inferSelect;
export type InsertOrganizationFeatureFlag = z.infer<typeof insertOrganizationFeatureFlagSchema>;

export type RegistrationPeriod = typeof registrationPeriods.$inferSelect;
export type InsertRegistrationPeriod = z.infer<typeof insertRegistrationPeriodSchema>;

export type PlayerRegistration = typeof playerRegistrations.$inferSelect;
export type InsertPlayerRegistration = z.infer<typeof insertPlayerRegistrationSchema>;

export type TeamRegistration = typeof teamRegistrations.$inferSelect;
export type InsertTeamRegistration = z.infer<typeof insertTeamRegistrationSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Waitlist = typeof waitlists.$inferSelect;
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;

export type DraftPool = typeof draftPools.$inferSelect;
export type InsertDraftPool = z.infer<typeof insertDraftPoolSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type HouseLeagueTeam = typeof houseLeagueTeams.$inferSelect;
export type InsertHouseLeagueTeam = z.infer<typeof insertHouseLeagueTeamSchema>;

export type OrganizationIcalFeed = typeof organizationIcalFeeds.$inferSelect;
export type InsertOrganizationIcalFeed = z.infer<typeof insertOrganizationIcalFeedSchema>;

export type ExternalCalendarEvent = typeof externalCalendarEvents.$inferSelect;
export type InsertExternalCalendarEvent = z.infer<typeof insertExternalCalendarEventSchema>;

export type BookingRequest = typeof bookingRequests.$inferSelect;
export type InsertBookingRequest = z.infer<typeof insertBookingRequestSchema>;

export type BookingApproval = typeof bookingApprovals.$inferSelect;
export type InsertBookingApproval = z.infer<typeof insertBookingApprovalSchema>;

export type DiamondRestriction = typeof diamondRestrictions.$inferSelect;
export type InsertDiamondRestriction = z.infer<typeof insertDiamondRestrictionSchema>;

export type NotificationLog = typeof notificationLog.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;

export type OrganizationCoordinator = typeof organizationCoordinators.$inferSelect;
export type InsertOrganizationCoordinator = z.infer<typeof insertOrganizationCoordinatorSchema>;

export type CoachInvitation = typeof coachInvitations.$inferSelect;
export type InsertCoachInvitation = z.infer<typeof insertCoachInvitationSchema>;

export type AdminInvitation = typeof adminInvitations.$inferSelect;
export type InsertAdminInvitation = z.infer<typeof insertAdminInvitationSchema>;

export const insertOrganizationTwilioSettingsSchema = createInsertSchema(organizationTwilioSettings);
export type OrganizationTwilioSettings = typeof organizationTwilioSettings.$inferSelect;
export type InsertOrganizationTwilioSettings = z.infer<typeof insertOrganizationTwilioSettingsSchema>;

export const insertOutboundSmsMessageSchema = createInsertSchema(outboundSmsMessages);
export type OutboundSmsMessage = typeof outboundSmsMessages.$inferSelect;
export type InsertOutboundSmsMessage = z.infer<typeof insertOutboundSmsMessageSchema>;

export const insertOrganizationWeatherSettingsSchema = createInsertSchema(organizationWeatherSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OrganizationWeatherSettings = typeof organizationWeatherSettings.$inferSelect;
export type InsertOrganizationWeatherSettings = z.infer<typeof insertOrganizationWeatherSettingsSchema>;

export const insertWeatherForecastSchema = createInsertSchema(weatherForecasts).omit({
  id: true,
  fetchedAt: true,
  updatedAt: true,
});
export type WeatherForecast = typeof weatherForecasts.$inferSelect;
export type InsertWeatherForecast = z.infer<typeof insertWeatherForecastSchema>;

export const insertCommunicationTemplateSchema = createInsertSchema(communicationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CommunicationTemplate = typeof communicationTemplates.$inferSelect;
export type InsertCommunicationTemplate = z.infer<typeof insertCommunicationTemplateSchema>;

export const insertTournamentMessageSchema = createInsertSchema(tournamentMessages).omit({
  id: true,
  sentAt: true,
});
export type TournamentMessage = typeof tournamentMessages.$inferSelect;
export type InsertTournamentMessage = z.infer<typeof insertTournamentMessageSchema>;

export const insertInboundSmsMessageSchema = createInsertSchema(inboundSmsMessages).omit({
  id: true,
  createdAt: true,
});
export type InboundSmsMessage = typeof inboundSmsMessages.$inferSelect;
export type InsertInboundSmsMessage = z.infer<typeof insertInboundSmsMessageSchema>;
