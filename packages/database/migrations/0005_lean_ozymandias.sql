ALTER TABLE "user_ai_settings" ADD COLUMN "fallback_provider" text;--> statement-breakpoint
ALTER TABLE "user_ai_settings" ADD COLUMN "fallback_model" text;--> statement-breakpoint
ALTER TABLE "user_ai_settings" ADD COLUMN "fallback_base_url" text;--> statement-breakpoint
ALTER TABLE "user_ai_settings" ADD COLUMN "fallback_api_key_ciphertext" text;--> statement-breakpoint
ALTER TABLE "user_ai_settings" ADD COLUMN "fallback_api_key_hint" text;