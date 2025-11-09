CREATE TABLE "matchups" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"pool_id" text NOT NULL,
	"home_team_id" text NOT NULL,
	"away_team_id" text NOT NULL,
	CONSTRAINT "matchups_tournament_id_pool_id_home_team_id_away_team_id_unique" UNIQUE("tournament_id","pool_id","home_team_id","away_team_id")
);
--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;