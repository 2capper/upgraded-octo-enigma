import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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
  city: text("city"),
  coach: text("coach"),
  phone: text("phone"),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  poolId: text("pool_id").notNull().references(() => pools.id, { onDelete: "cascade" }),
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
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTournamentSchema = createInsertSchema(tournaments).omit({
  createdAt: true,
});

export const insertAgeDivisionSchema = createInsertSchema(ageDivisions);
export const insertPoolSchema = createInsertSchema(pools);
export const insertTeamSchema = createInsertSchema(teams);
export const insertGameSchema = createInsertSchema(games);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
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
