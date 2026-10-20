CREATE TABLE "lab_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"arch" text DEFAULT 'x86_64' NOT NULL,
	"memory_mb" integer,
	"disk_gb" integer,
	"virtualization" text DEFAULT 'none' NOT NULL,
	"always_on" boolean DEFAULT false NOT NULL,
	"notes" text,
	"scopes" jsonb DEFAULT '["read"]'::jsonb NOT NULL,
	"secret_ciphertext" text,
	"secret_hint" text,
	"endpoint" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_resources" ADD CONSTRAINT "lab_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lab_resources_user_idx" ON "lab_resources" USING btree ("user_id");