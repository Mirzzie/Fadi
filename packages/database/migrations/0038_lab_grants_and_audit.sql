CREATE TABLE "lab_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"origin" text,
	"capability" text NOT NULL,
	"resource_id" uuid,
	"command" text,
	"decision" text NOT NULL,
	"detail" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_id" uuid,
	"capability" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_actions" ADD CONSTRAINT "lab_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_grants" ADD CONSTRAINT "lab_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_grants" ADD CONSTRAINT "lab_grants_resource_id_lab_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."lab_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lab_actions_user_idx" ON "lab_actions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "lab_grants_user_idx" ON "lab_grants" USING btree ("user_id","capability");