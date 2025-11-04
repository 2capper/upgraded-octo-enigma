import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, index, varchar, uniqueIndex } from "drizzle-orm/pg-core";
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

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
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
  stripeAccountId: text("stripe_account_id"), // For future payment processing
  timezone: text("timezone").default("America/Toronto"), // IANA timezone identifier
  defaultPrimaryColor: text("default_primary_color").default("#22c55e"), // Default color for new tournaments
  defaultSecondaryColor: text("default_secondary_color").default("#ffffff"), // Default secondary color for new tournaments
  defaultPlayoffFormat: text("default_playoff_format").default("top_6"), // Default playoff format for new tournaments
  defaultSeedingPattern: text("default_seeding_pattern").default("standard"), // Default seeding pattern for new tournaments
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
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ageDivisions = pgTable("age_divisions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
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
  coach: text("coach"),
  phone: text("phone"),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  poolId: text("pool_id").notNull().references(() => pools.id, { onDelete: "cascade" }),
  rosterLink: text("roster_link"),
  teamNumber: varchar("team_number", { length: 10 }), // 6-digit OBA team number for roster URL
  pitchCountAppName: text("pitch_count_app_name"),
  pitchCountName: text("pitch_count_name"),
  gameChangerName: text("game_changer_name"),
  rosterData: text("roster_data"), // JSON string of roster players
});

export const games = pgTable("games", {
  id: text("id").primaryKey(),
  homeTeamId: text("home_team_id").references(() => teams.id, { onDelete: "cascade" }),
  awayTeamId: text("away_team_id").references(() => teams.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("scheduled"), // "scheduled" | "completed"
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  homeInningsBatted: decimal("home_innings_batted"),
  awayInningsBatted: decimal("away_innings_batted"),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  poolId: text("pool_id").notNull().references(() => pools.id, { onDelete: "cascade" }),
  forfeitStatus: text("forfeit_status").notNull().default("none"), // "none" | "home" | "away"
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  subVenue: text("sub_venue"),
  isPlayoff: boolean("is_playoff").notNull().default(false),
  // Playoff bracket fields
  playoffRound: integer("playoff_round"),
  playoffGameNumber: integer("playoff_game_number"),
  playoffBracket: text("playoff_bracket"), // 'winners' | 'losers' | 'championship'
  team1Source: jsonb("team1_source"), // { gameNumber: number, position: 'winner' | 'loser' }
  team2Source: jsonb("team2_source"), // { gameNumber: number, position: 'winner' | 'loser' }
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

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  tournaments: many(tournaments),
  admins: many(organizationAdmins),
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

export const insertTournamentSchema = createInsertSchema(tournaments).omit({
  createdAt: true,
});

export const insertAgeDivisionSchema = createInsertSchema(ageDivisions);
export const insertPoolSchema = createInsertSchema(pools);
export const insertTeamSchema = createInsertSchema(teams);
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
  numberOfPlayoffTeams: z.number().int().min(2).max(32).default(6), // DEPRECATED
  playoffFormat: z.string().optional(), // "top_4" | "top_6" | "top_8" | "all_seeded" | "championship_consolation" | "double_elim_12" | etc
  showTiebreakers: z.boolean().default(true),
  customName: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#22c55e"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#ffffff"),
  logoUrl: z.string().url().max(2000).optional().or(z.literal('')),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;

export type AgeDivision = typeof ageDivisions.$inferSelect;
export type InsertAgeDivision = z.infer<typeof insertAgeDivisionSchema>;

export type Pool = typeof pools.$inferSelect;
export type InsertPool = z.infer<typeof insertPoolSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

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
