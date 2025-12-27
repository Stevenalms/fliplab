import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  totalMatches: integer("total_matches").default(0),
  wins: integer("wins").default(0),
  rating: integer("rating").default(1000),
  createdAt: timestamp("created_at").defaultNow(),
});

// Matches table
export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").default("waiting"), // waiting, active, voting, showcase, completed
  genre: text("genre").notNull(), // soul, funk, jazz
  gameMode: text("game_mode").default("battle"), // battle (4p) or duel (1v1)
  sample: text("sample").notNull(),
  sampleUrl: text("sample_url"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Match participants table
export const matchParticipants = pgTable("match_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  userId: varchar("user_id").notNull(),
  projectName: text("project_name").default("Untitled"),
  audioData: text("audio_data"), // Base64 encoded audio or metadata
  flipScore: integer("flip_score").default(0),
  drumScore: integer("drum_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Votes table
export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  voterId: varchar("voter_id").notNull(),
  flipVoteId: varchar("flip_vote_id"), // userId of winner for best flip
  createdAt: timestamp("created_at").defaultNow(),
});

// Leaderboard (denormalized for speed)
export const leaderboard = pgTable("leaderboard", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  username: text("username").notNull(),
  totalMatches: integer("total_matches").default(0),
  wins: integer("wins").default(0),
  rating: integer("rating").default(1000),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Queue for matchmaking
export const matchmakingQueue = pgTable("matchmaking_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  genre: text("genre").notNull(),
  gameMode: text("game_mode").default("battle"), // battle (4p) or duel (1v1)
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Drafts table for saving work in progress
export const drafts = pgTable("drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  sampleId: text("sample_id").notNull(),
  genre: text("genre").notNull(),
  bpm: integer("bpm").default(90),
  drumPattern: jsonb("drum_pattern"),
  effectSettings: jsonb("effect_settings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schemas for validation
export const insertUserSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(6),
});

export const insertMatchSchema = z.object({
  genre: z.enum(["soul", "funk", "jazz"]),
  gameMode: z.enum(["battle", "duel"]).default("battle"),
  sample: z.string(),
  sampleUrl: z.string().optional(),
});

export const insertMatchParticipantSchema = z.object({
  matchId: z.string(),
  userId: z.string(),
  projectName: z.string(),
  audioData: z.string().optional(),
});

export const insertVoteSchema = z.object({
  matchId: z.string(),
  voterId: z.string(),
  flipVoteId: z.string(),
});

export const insertDraftSchema = z.object({
  userId: z.string(),
  name: z.string(),
  sampleId: z.string(),
  genre: z.string(),
  bpm: z.number().optional(),
  drumPattern: z.any().optional(),
  effectSettings: z.any().optional(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type InsertMatchParticipant = z.infer<typeof insertMatchParticipantSchema>;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

export type Leaderboard = typeof leaderboard.$inferSelect;

export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = z.infer<typeof insertDraftSchema>;
