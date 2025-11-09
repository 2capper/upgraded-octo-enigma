CREATE TABLE "admin_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"message" text NOT NULL,
	"organization_name" text NOT NULL,
	"organization_slug" text NOT NULL,
	"organization_description" text,
	"logo_url" text,
	"primary_color" text DEFAULT '#22c55e',
	"secondary_color" text DEFAULT '#ffffff',
	"website_url" text,
	"contact_email" text,
	"timezone" text DEFAULT 'America/Toronto',
	"default_playoff_format" text DEFAULT 'top_6',
	"default_seeding_pattern" text DEFAULT 'standard',
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_organization_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "age_divisions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tournament_id" text NOT NULL,
	"default_game_duration" integer DEFAULT 90 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_request_id" varchar NOT NULL,
	"approver_role" text NOT NULL,
	"approver_id" varchar NOT NULL,
	"decision" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"house_league_team_id" varchar NOT NULL,
	"booking_type" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"diamond_id" varchar,
	"requested_diamond_name" text,
	"opponent_team_id" varchar,
	"opponent_name" text,
	"requires_umpire" boolean DEFAULT false NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_by" varchar NOT NULL,
	"submitted_at" timestamp,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"team_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"accepted_at" timestamp,
	"accepted_by_user_id" varchar,
	"invited_by" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coach_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "diamond_restrictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"division" text NOT NULL,
	"allowed_diamonds" text[] NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "draft_pools" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"division" text NOT NULL,
	"sport" text NOT NULL,
	"season" text NOT NULL,
	"number_of_teams" integer NOT NULL,
	"players_per_team" integer,
	"draft_date" timestamp,
	"status" text DEFAULT 'open' NOT NULL,
	"draft_order" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_calendar_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"ical_feed_id" varchar NOT NULL,
	"external_event_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_date" text NOT NULL,
	"end_time" text NOT NULL,
	"diamond_id" varchar,
	"raw_location" text,
	"division" text,
	"team_name" text,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_key" varchar(100) NOT NULL,
	"display_name" text NOT NULL,
	"description" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"icon" text,
	"coming_soon_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_feature_key_unique" UNIQUE("feature_key")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"home_team_id" text,
	"away_team_id" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_innings_batted" numeric,
	"away_innings_batted" numeric,
	"tournament_id" text NOT NULL,
	"pool_id" text NOT NULL,
	"forfeit_status" text DEFAULT 'none' NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"duration_minutes" integer DEFAULT 90 NOT NULL,
	"location" text NOT NULL,
	"sub_venue" text,
	"diamond_id" varchar,
	"matchup_id" text,
	"is_playoff" boolean DEFAULT false NOT NULL,
	"playoff_round" integer,
	"playoff_game_number" integer,
	"playoff_bracket" text,
	"team1_source" jsonb,
	"team2_source" jsonb
);
--> statement-breakpoint
CREATE TABLE "house_league_teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"division" text NOT NULL,
	"coach_first_name" text,
	"coach_last_name" text,
	"coach_email" text,
	"coach_phone" text,
	"coach_user_id" varchar,
	"external_team_id" text,
	"last_synced_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"calendar_subscription_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "house_league_teams_calendar_subscription_token_unique" UNIQUE("calendar_subscription_token")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"tournament_id" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"message_type" text NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_division" text,
	"recipient_team_id" text,
	"recipient_emails" text[],
	"recipient_phones" text[],
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"template_name" text,
	"sendgrid_message_id" text,
	"twilio_message_ids" text[],
	"sent_by" varchar NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"booking_request_id" varchar,
	"notification_type" text NOT NULL,
	"channel" text NOT NULL,
	"recipient_user_id" varchar,
	"recipient_email" text,
	"recipient_phone" text,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failure_reason" text,
	"provider_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oba_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"team_name" text NOT NULL,
	"organization" text,
	"division" text,
	"level" text,
	"affiliate" text,
	"has_roster" boolean DEFAULT false NOT NULL,
	"player_count" integer DEFAULT 0,
	"last_scanned" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"roster_data" jsonb,
	CONSTRAINT "oba_teams_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
CREATE TABLE "organization_admins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_coordinators" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_feature_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"feature_flag_id" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_ical_feeds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"diamond_mapping" jsonb,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_url" text,
	"primary_color" text DEFAULT '#22c55e',
	"secondary_color" text DEFAULT '#ffffff',
	"website_url" text,
	"contact_email" text,
	"stripe_account_id" text,
	"timezone" text DEFAULT 'America/Toronto',
	"default_primary_color" text DEFAULT '#22c55e',
	"default_secondary_color" text DEFAULT '#ffffff',
	"default_playoff_format" text DEFAULT 'top_6',
	"default_seeding_pattern" text DEFAULT 'standard',
	"calendar_subscription_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_calendar_subscription_token_unique" UNIQUE("calendar_subscription_token")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"player_registration_id" varchar,
	"team_registration_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'CAD' NOT NULL,
	"payment_method" text NOT NULL,
	"payment_provider" text,
	"stripe_payment_intent_id" text,
	"paypal_order_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_registrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_period_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"gender" text,
	"division" text NOT NULL,
	"shirt_size" text NOT NULL,
	"parent_first_name" text NOT NULL,
	"parent_last_name" text NOT NULL,
	"parent_email" text NOT NULL,
	"parent_phone" text NOT NULL,
	"address" text,
	"city" text,
	"postal_code" text,
	"medical_conditions" text,
	"allergies" text,
	"emergency_contact" text,
	"emergency_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"payment_amount" numeric(10, 2),
	"discount_applied" numeric(10, 2),
	"draft_pool_id" varchar,
	"assigned_team" text,
	"uniform_ordered" boolean DEFAULT false NOT NULL,
	"uniform_received" boolean DEFAULT false NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tournament_id" text NOT NULL,
	"age_division_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_periods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"program_type" text NOT NULL,
	"sport" text NOT NULL,
	"divisions" text[],
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"early_bird_date" timestamp,
	"early_bird_price" numeric(10, 2),
	"regular_price" numeric(10, 2) NOT NULL,
	"max_capacity" integer,
	"current_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"allow_waitlist" boolean DEFAULT true NOT NULL,
	"multi_family_discount" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_registrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_period_id" varchar,
	"organization_id" varchar NOT NULL,
	"tournament_id" text,
	"team_name" text NOT NULL,
	"division" text NOT NULL,
	"city" text,
	"coach_first_name" text NOT NULL,
	"coach_last_name" text NOT NULL,
	"coach_email" text NOT NULL,
	"coach_phone" text NOT NULL,
	"oba_number" varchar(10),
	"pitch_count_app_number" text,
	"roster_data" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"payment_amount" numeric(10, 2),
	"created_team_id" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"division" text,
	"city" text,
	"coach" text,
	"coach_first_name" text,
	"coach_last_name" text,
	"coach_email" text,
	"phone" text,
	"tournament_id" text NOT NULL,
	"pool_id" text NOT NULL,
	"roster_link" text,
	"team_number" varchar(10),
	"pitch_count_app_name" text,
	"pitch_count_name" text,
	"game_changer_name" text,
	"roster_data" text,
	"registration_status" text,
	"payment_status" text,
	"is_placeholder" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"type" text DEFAULT 'pool_play' NOT NULL,
	"number_of_teams" integer DEFAULT 8,
	"number_of_pools" integer DEFAULT 2,
	"number_of_playoff_teams" integer DEFAULT 6,
	"playoff_format" text,
	"seeding_pattern" text,
	"show_tiebreakers" boolean DEFAULT true NOT NULL,
	"custom_name" text,
	"primary_color" text DEFAULT '#22c55e',
	"secondary_color" text DEFAULT '#ffffff',
	"logo_url" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"min_game_guarantee" integer,
	"number_of_diamonds" integer,
	"diamond_details" jsonb,
	"selected_diamond_ids" text[],
	"min_rest_minutes" integer DEFAULT 30 NOT NULL,
	"rest_between_2nd_3rd_game" integer DEFAULT 60 NOT NULL,
	"max_games_per_day" integer DEFAULT 3 NOT NULL,
	"organization_id" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "waitlists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_period_id" varchar NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"parent_email" text NOT NULL,
	"parent_phone" text NOT NULL,
	"division" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"position" integer NOT NULL,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_created_organization_id_organizations_id_fk" FOREIGN KEY ("created_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_divisions" ADD CONSTRAINT "age_divisions_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_approvals" ADD CONSTRAINT "booking_approvals_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_approvals" ADD CONSTRAINT "booking_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_house_league_team_id_house_league_teams_id_fk" FOREIGN KEY ("house_league_team_id") REFERENCES "public"."house_league_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_diamond_id_diamonds_id_fk" FOREIGN KEY ("diamond_id") REFERENCES "public"."diamonds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_opponent_team_id_house_league_teams_id_fk" FOREIGN KEY ("opponent_team_id") REFERENCES "public"."house_league_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_invitations" ADD CONSTRAINT "coach_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_invitations" ADD CONSTRAINT "coach_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_invitations" ADD CONSTRAINT "coach_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diamond_restrictions" ADD CONSTRAINT "diamond_restrictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diamonds" ADD CONSTRAINT "diamonds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_pools" ADD CONSTRAINT "draft_pools_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_ical_feed_id_organization_ical_feeds_id_fk" FOREIGN KEY ("ical_feed_id") REFERENCES "public"."organization_ical_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_diamond_id_diamonds_id_fk" FOREIGN KEY ("diamond_id") REFERENCES "public"."diamonds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_diamond_id_diamonds_id_fk" FOREIGN KEY ("diamond_id") REFERENCES "public"."diamonds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_league_teams" ADD CONSTRAINT "house_league_teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_league_teams" ADD CONSTRAINT "house_league_teams_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_team_id_teams_id_fk" FOREIGN KEY ("recipient_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD CONSTRAINT "organization_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_admins" ADD CONSTRAINT "organization_admins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_coordinators" ADD CONSTRAINT "organization_coordinators_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_coordinators" ADD CONSTRAINT "organization_coordinators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_feature_flags" ADD CONSTRAINT "organization_feature_flags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_feature_flags" ADD CONSTRAINT "organization_feature_flags_feature_flag_id_feature_flags_id_fk" FOREIGN KEY ("feature_flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_ical_feeds" ADD CONSTRAINT "organization_ical_feeds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_player_registration_id_player_registrations_id_fk" FOREIGN KEY ("player_registration_id") REFERENCES "public"."player_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_team_registration_id_team_registrations_id_fk" FOREIGN KEY ("team_registration_id") REFERENCES "public"."team_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_registration_period_id_registration_periods_id_fk" FOREIGN KEY ("registration_period_id") REFERENCES "public"."registration_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_draft_pool_id_draft_pools_id_fk" FOREIGN KEY ("draft_pool_id") REFERENCES "public"."draft_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_registrations" ADD CONSTRAINT "player_registrations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_age_division_id_age_divisions_id_fk" FOREIGN KEY ("age_division_id") REFERENCES "public"."age_divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_periods" ADD CONSTRAINT "registration_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_registrations" ADD CONSTRAINT "team_registrations_registration_period_id_registration_periods_id_fk" FOREIGN KEY ("registration_period_id") REFERENCES "public"."registration_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_registrations" ADD CONSTRAINT "team_registrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_registrations" ADD CONSTRAINT "team_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_registrations" ADD CONSTRAINT "team_registrations_created_team_id_teams_id_fk" FOREIGN KEY ("created_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_registrations" ADD CONSTRAINT "team_registrations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_registration_period_id_registration_periods_id_fk" FOREIGN KEY ("registration_period_id") REFERENCES "public"."registration_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "diamond_restriction_org_division_idx" ON "diamond_restrictions" USING btree ("organization_id","division");--> statement-breakpoint
CREATE UNIQUE INDEX "external_event_ical_uid_idx" ON "external_calendar_events" USING btree ("ical_feed_id","external_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_coordinator_role_idx" ON "organization_coordinators" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "org_feature_flags_uniq_idx" ON "organization_feature_flags" USING btree ("organization_id","feature_flag_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");