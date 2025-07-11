-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."AudioLifecycle" AS ENUM('ACTIVE', 'MODERATED');--> statement-breakpoint
CREATE TYPE "public"."AudioVisibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."WhitelistRequestStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"robloxId" text NOT NULL,
	"username" text NOT NULL,
	"avatar" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"provider" text NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"expiresAt" timestamp with time zone,
	"scope" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audios" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"is_previewable" boolean DEFAULT true NOT NULL,
	"audio_url" text,
	"requester" jsonb DEFAULT '{"roblox":{"id":null,"username":null},"discord":{"id":null,"username":null}}'::jsonb NOT NULL,
	"whitelister" jsonb DEFAULT '{"roblox":{"id":null,"username":null},"discord":{"id":null,"username":null}}'::jsonb NOT NULL,
	"audio_lifecycle" "AudioLifecycle" DEFAULT 'ACTIVE' NOT NULL,
	"audio_visibility" "AudioVisibility" DEFAULT 'PUBLIC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "whitelist_requests" (
	"status" "WhitelistRequestStatus" DEFAULT 'PENDING' NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"audio_id" text NOT NULL,
	"audio_visibility" "AudioVisibility" DEFAULT 'PUBLIC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"request_id" text PRIMARY KEY NOT NULL,
	"requester" jsonb NOT NULL,
	"userId" text NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"audio_url" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whitelist_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "Audio" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"whitelisterName" text NOT NULL,
	"whitelisterUserId" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"whitelisterType" text NOT NULL,
	"private" boolean DEFAULT false NOT NULL,
	"audioUrl" text,
	"version" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Audio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "whitelist_requests" ADD CONSTRAINT "whitelist_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "users_robloxId_key" ON "users" USING btree ("robloxId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_tokens_userId_provider_key" ON "oauth_tokens" USING btree ("userId" text_ops,"provider" text_ops);--> statement-breakpoint
CREATE POLICY "public_read_only" ON "audios" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "public_read_only" ON "Audio" AS PERMISSIVE FOR SELECT TO public USING (true);
*/