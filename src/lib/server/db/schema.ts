import { pgTable, uniqueIndex, text, timestamp, foreignKey, pgPolicy, bigint, boolean, jsonb, integer, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const audioLifecycle = pgEnum("AudioLifecycle", ['ACTIVE', 'MODERATED'])
export const audioVisibility = pgEnum("AudioVisibility", ['PUBLIC', 'PRIVATE'])
export const whitelistRequestStatus = pgEnum("WhitelistRequestStatus", ['PENDING', 'APPROVED', 'REJECTED'])

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	robloxId: text().notNull(),
	username: text().notNull(),
	avatar: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("users_robloxId_key").using("btree", table.robloxId.asc().nullsLast().op("text_ops")),
]).enableRLS();

export const sessions = pgTable("sessions", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]).enableRLS();

export const oauthTokens = pgTable("oauth_tokens", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	provider: text().notNull(),
	accessToken: text().notNull(),
	refreshToken: text(),
	expiresAt: timestamp({ withTimezone: true, mode: 'string' }),
	scope: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("oauth_tokens_userId_provider_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "oauth_tokens_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]).enableRLS();

export const audios = pgTable("audios", {
	id: bigint({ mode: "bigint" }).primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	isPreviewable: boolean("is_previewable").default(true).notNull(),
	audioUrl: text("audio_url"),
	requester: jsonb().default({"roblox":{"id":null,"username":null},"discord":{"id":null,"username":null}}).notNull(),
	whitelister: jsonb().default({"roblox":{"id":null,"username":null},"discord":{"id":null,"username":null}}).notNull(),
	audioLifecycle: audioLifecycle("audio_lifecycle").default('ACTIVE').notNull(),
	audioVisibility: audioVisibility("audio_visibility").default('PUBLIC').notNull(),
	created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	pgPolicy("public_read_only", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]).enableRLS();

export const whitelistRequests = pgTable("whitelist_requests", {
	status: whitelistRequestStatus().default('PENDING').notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	category: text().notNull(),
	name: text().notNull(),
	audioId: text("audio_id").notNull(),
	audioVisibility: audioVisibility("audio_visibility").default('PUBLIC').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	requestId: text("request_id").primaryKey().notNull(),
	requester: jsonb().notNull(),
	userId: text().notNull(),
	acknowledged: boolean().default(false).notNull(),
	userNotified: boolean("user_notified").default(false).notNull(),
	audioUrl: text("audio_url").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "whitelist_requests_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]).enableRLS();

export const audio = pgTable("Audio", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	whitelisterName: text().notNull(),
	whitelisterUserId: bigint({ mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	whitelisterType: text().notNull(),
	private: boolean().default(false).notNull(),
	audioUrl: text(),
	version: integer().default(2).notNull(),
}, (table) => [
	pgPolicy("public_read_only", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);
