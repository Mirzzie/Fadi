ALTER TABLE "agent_messages" ADD COLUMN "work_item_id" uuid;--> statement-breakpoint
CREATE INDEX "agent_messages_thread_idx" ON "agent_messages" USING btree ("user_id","work_item_id","created_at");