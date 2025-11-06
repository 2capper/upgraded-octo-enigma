CREATE TABLE "diamonds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"available_start_time" text DEFAULT '08:00' NOT NULL,
	"available_end_time" text DEFAULT '20:00' NOT NULL,
	"has_lights" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "diamond_id" varchar;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "selected_diamond_ids" text[];--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "min_rest_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "rest_between_2nd_3rd_game" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "max_games_per_day" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "diamonds" ADD CONSTRAINT "diamonds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_diamond_id_diamonds_id_fk" FOREIGN KEY ("diamond_id") REFERENCES "public"."diamonds"("id") ON DELETE set null ON UPDATE no action;