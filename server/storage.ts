import {
  type User,
  type InsertUser,
  type Match,
  type InsertMatch,
  type MatchParticipant,
  type InsertMatchParticipant,
  type Vote,
  type InsertVote,
  type Leaderboard,
  type Draft,
  type InsertDraft,
  users,
  matches,
  matchParticipants,
  votes,
  leaderboard,
  matchmakingQueue,
  drafts,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStats(userId: string, stats: any): Promise<void>;
  
  createMatch(match: InsertMatch): Promise<Match>;
  getMatch(id: string): Promise<Match | undefined>;
  updateMatchStatus(id: string, status: string): Promise<void>;
  getActiveMatches(): Promise<Match[]>;
  getUserActiveMatch(userId: string): Promise<Match | null>;
  
  addParticipant(participant: InsertMatchParticipant): Promise<MatchParticipant>;
  getMatchParticipants(matchId: string): Promise<MatchParticipant[]>;
  updateParticipantAudio(participantId: string, audioData: string): Promise<void>;
  
  submitVote(vote: InsertVote): Promise<Vote>;
  getMatchVotes(matchId: string): Promise<Vote[]>;
  
  addToQueue(userId: string, genre: string, gameMode?: string): Promise<void>;
  removeFromQueue(userId: string): Promise<void>;
  getQueueByGenre(genre: string, gameMode?: string): Promise<any[]>;
  
  getLeaderboard(limit?: number): Promise<Leaderboard[]>;
  getUserRank(userId: string): Promise<number | undefined>;
  updateLeaderboard(userId: string): Promise<void>;
  
  createDraft(draft: InsertDraft): Promise<Draft>;
  getDraftsByUser(userId: string): Promise<Draft[]>;
  getDraft(id: string): Promise<Draft | undefined>;
  updateDraft(id: string, draft: Partial<InsertDraft>): Promise<void>;
  deleteDraft(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    
    await db.insert(leaderboard).values({
      userId: user.id,
      username: insertUser.username,
      totalMatches: 0,
      wins: 0,
      rating: 1000,
    });
    
    return user;
  }

  async updateUserStats(userId: string, stats: any): Promise<void> {
    await db.update(users).set(stats).where(eq(users.id, userId));
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await db.insert(matches).values({
      genre: match.genre,
      gameMode: match.gameMode || "battle",
      sample: match.sample,
      sampleUrl: match.sampleUrl,
      status: "waiting",
    }).returning();
    return newMatch;
  }

  async getMatch(id: string): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match || undefined;
  }

  async updateMatchStatus(id: string, status: string): Promise<void> {
    const updates: any = { status };
    if (status === "active") {
      updates.startTime = new Date();
    } else if (status === "completed") {
      updates.endTime = new Date();
    }
    await db.update(matches).set(updates).where(eq(matches.id, id));
  }

  async getActiveMatches(): Promise<Match[]> {
    return db.select().from(matches).where(
      or(eq(matches.status, "active"), eq(matches.status, "voting"))
    );
  }

  async getUserActiveMatch(userId: string): Promise<Match | null> {
    const result = await db
      .select({ match: matches })
      .from(matchParticipants)
      .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
      .where(
        and(
          eq(matchParticipants.userId, userId),
          eq(matches.status, "active")
        )
      )
      .limit(1);
    
    return result.length > 0 ? result[0].match : null;
  }

  async addParticipant(participant: InsertMatchParticipant): Promise<MatchParticipant> {
    const [newParticipant] = await db.insert(matchParticipants).values({
      matchId: participant.matchId,
      userId: participant.userId,
      projectName: participant.projectName,
      audioData: participant.audioData,
    }).returning();
    return newParticipant;
  }

  async getMatchParticipants(matchId: string): Promise<MatchParticipant[]> {
    return db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchId));
  }

  async updateParticipantAudio(participantId: string, audioData: string): Promise<void> {
    await db.update(matchParticipants).set({ audioData }).where(eq(matchParticipants.id, participantId));
  }

  async submitVote(vote: InsertVote): Promise<Vote> {
    const [newVote] = await db.insert(votes).values({
      matchId: vote.matchId,
      voterId: vote.voterId,
      flipVoteId: vote.flipVoteId,
    }).returning();
    return newVote;
  }

  async getMatchVotes(matchId: string): Promise<Vote[]> {
    return db.select().from(votes).where(eq(votes.matchId, matchId));
  }

  async addToQueue(userId: string, genre: string, gameMode: string = "battle"): Promise<void> {
    await db.insert(matchmakingQueue).values({
      userId,
      genre,
      gameMode,
    }).onConflictDoUpdate({
      target: matchmakingQueue.userId,
      set: { genre, gameMode, joinedAt: new Date() },
    });
  }

  async removeFromQueue(userId: string): Promise<void> {
    await db.delete(matchmakingQueue).where(eq(matchmakingQueue.userId, userId));
  }

  async getQueueByGenre(genre: string, gameMode: string = "battle"): Promise<any[]> {
    const rows = await db.select().from(matchmakingQueue).where(
      and(eq(matchmakingQueue.genre, genre), eq(matchmakingQueue.gameMode, gameMode))
    ).orderBy(matchmakingQueue.joinedAt);
    return rows.map(row => ({
      userId: row.userId,
      genre: row.genre,
      gameMode: row.gameMode,
      joinedAt: row.joinedAt,
    }));
  }

  async getLeaderboard(limit = 100): Promise<Leaderboard[]> {
    return db.select().from(leaderboard).orderBy(desc(leaderboard.rating)).limit(limit);
  }

  async getUserRank(userId: string): Promise<number | undefined> {
    const result = await db.execute(sql`
      SELECT position FROM (
        SELECT user_id, ROW_NUMBER() OVER (ORDER BY rating DESC) as position
        FROM leaderboard
      ) ranked WHERE user_id = ${userId}
    `);
    if (result.rows && result.rows.length > 0) {
      return Number(result.rows[0].position);
    }
    return undefined;
  }

  async updateLeaderboard(userId: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user) {
      await db.update(leaderboard).set({
        totalMatches: user.totalMatches,
        wins: user.wins,
        rating: user.rating,
        updatedAt: new Date(),
      }).where(eq(leaderboard.userId, userId));
    }
  }

  async createDraft(draft: InsertDraft): Promise<Draft> {
    const [newDraft] = await db.insert(drafts).values({
      userId: draft.userId,
      name: draft.name,
      sampleId: draft.sampleId,
      genre: draft.genre,
      bpm: draft.bpm ?? 90,
      drumPattern: draft.drumPattern,
      effectSettings: draft.effectSettings,
    }).returning();
    return newDraft;
  }

  async getDraftsByUser(userId: string): Promise<Draft[]> {
    return db.select().from(drafts).where(eq(drafts.userId, userId)).orderBy(desc(drafts.updatedAt));
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.id, id));
    return draft || undefined;
  }

  async updateDraft(id: string, draft: Partial<InsertDraft>): Promise<void> {
    await db.update(drafts).set({ ...draft, updatedAt: new Date() }).where(eq(drafts.id, id));
  }

  async deleteDraft(id: string): Promise<void> {
    await db.delete(drafts).where(eq(drafts.id, id));
  }
}

export const storage = new DatabaseStorage();
