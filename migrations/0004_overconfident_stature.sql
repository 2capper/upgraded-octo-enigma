CREATE TABLE "admin_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp,
	"accepted_by_user_id" varchar,
	"invited_by" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_twilio_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"account_sid" text NOT NULL,
	"auth_token" text NOT NULL,
	"phone_number" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"daily_limit" integer DEFAULT 100 NOT NULL,
	"rate_limit" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_twilio_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "organization_weather_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"api_key" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"lightning_radius_miles" integer DEFAULT 10 NOT NULL,
	"heat_index_threshold_f" integer DEFAULT 94 NOT NULL,
	"wind_speed_threshold_mph" integer DEFAULT 25 NOT NULL,
	"precipitation_threshold_pct" integer DEFAULT 70 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_weather_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "outbound_sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"tournament_id" text,
	"team_id" text,
	"recipient_phone" text NOT NULL,
	"recipient_name" text,
	"message_body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"twilio_message_sid" text,
	"error_code" text,
	"error_message" text,
	"sent_by" varchar NOT NULL,
	"character_count" integer NOT NULL,
	"segment_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" text NOT NULL,
	"sent_by" varchar NOT NULL,
	"content" text NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_count" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_forecasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"organization_id" varchar NOT NULL,
	"latitude" numeric NOT NULL,
	"longitude" numeric NOT NULL,
	"forecast_time" timestamp NOT NULL,
	"temperature_f" numeric,
	"feels_like_f" numeric,
	"heat_index_f" numeric,
	"precipitation_probability" integer,
	"precipitation_inches" numeric,
	"wind_speed_mph" numeric,
	"wind_gust_mph" numeric,
	"humidity" integer,
	"uv_index" numeric,
	"visibility_miles" numeric,
	"condition" text,
	"condition_icon" text,
	"has_lightning_alert" boolean DEFAULT false NOT NULL,
	"has_heat_alert" boolean DEFAULT false NOT NULL,
	"has_wind_alert" boolean DEFAULT false NOT NULL,
	"has_precipitation_alert" boolean DEFAULT false NOT NULL,
	"has_severe_weather_alert" boolean DEFAULT false NOT NULL,
	"alert_message" text,
	"raw_response" jsonb,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "weather_status" text DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "admin_email" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "coach_phone" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "manager_name" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "manager_phone" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "assistant_name" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "assistant_phone" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "management_token" text;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_twilio_settings" ADD CONSTRAINT "organization_twilio_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_weather_settings" ADD CONSTRAINT "organization_weather_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_sms_messages" ADD CONSTRAINT "outbound_sms_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_sms_messages" ADD CONSTRAINT "outbound_sms_messages_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_sms_messages" ADD CONSTRAINT "outbound_sms_messages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_sms_messages" ADD CONSTRAINT "outbound_sms_messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_messages" ADD CONSTRAINT "tournament_messages_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_messages" ADD CONSTRAINT "tournament_messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_forecasts" ADD CONSTRAINT "weather_forecasts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_forecasts" ADD CONSTRAINT "weather_forecasts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "weather_forecasts_game_idx" ON "weather_forecasts" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "weather_forecasts_forecast_time_idx" ON "weather_forecasts" USING btree ("forecast_time");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_management_token_unique" UNIQUE("management_token");