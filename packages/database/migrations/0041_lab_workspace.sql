CREATE TABLE "lab_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"workspace_root" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_settings" ADD CONSTRAINT "lab_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;