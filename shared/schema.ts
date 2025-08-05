import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, index, varchar } from "drizzle-orm/pg-core";
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

export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
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
});

// Relations
export const tournamentsRelations = relations(tournaments, ({ many }) => ({
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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

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
