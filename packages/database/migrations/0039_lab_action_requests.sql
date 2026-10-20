CREATE TABLE "lab_action_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipe" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"argv" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text NOT NULL,
	"reversal" text,
	"actor" text NOT NULL,
	"origin" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_action_requests" ADD CONSTRAINT "lab_action_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lab_action_requests_user_idx" ON "lab_action_requests" USING btree ("user_id","status");