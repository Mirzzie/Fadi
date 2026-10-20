CREATE TABLE "work_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_item_id" uuid,
	"surface" text DEFAULT 'web' NOT NULL,
	"action" text NOT NULL,
	"risk" text DEFAULT 'read' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"receipt" text DEFAULT '' NOT NULL,
	"error" text,
	"approval_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"career_profile_id" uuid,
	"parent_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_executions" ADD CONSTRAINT "work_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_executions" ADD CONSTRAINT "work_executions_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_outputs" ADD CONSTRAINT "work_outputs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_outputs" ADD CONSTRAINT "work_outputs_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_executions_user_idx" ON "work_executions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "work_executions_item_idx" ON "work_executions" USING btree ("work_item_id","started_at");--> statement-breakpoint
CREATE INDEX "work_items_user_status_idx" ON "work_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "work_items_parent_idx" ON "work_items" USING btree ("user_id","parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "work_outputs_item_ref_unique" ON "work_outputs" USING btree ("work_item_id","kind","ref_id");--> statement-breakpoint
CREATE INDEX "work_outputs_user_idx" ON "work_outputs" USING btree ("user_id","kind");