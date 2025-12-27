import { storage } from "./storage";
import type { Express } from "express";
import { log } from "./index";
import { getRandomSample } from "@shared/samples";

interface QueuedPlayer {
  userId: string;
  genre: string;
  gameMode: string;
  joinedAt: Date;
}

export const userSocketMap = new Map<string, string>();

export let broadcastMatchStarted: ((matchId: string, players: QueuedPlayer[], gameMode: string) => void) | null = null;

export function setBroadcastMatchStarted(callback: (matchId: string, players: QueuedPlayer[], gameMode: string) => void) {
  broadcastMatchStarted = callback;
}

export class Matchmaker {
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    // Check for matches every 2 seconds
    this.checkInterval = setInterval(() => this.tryCreateMatches(), 2000);
    log("Matchmaker started");
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async joinQueue(userId: string, genre: string, gameMode: string = "battle") {
    await storage.addToQueue(userId, genre, gameMode);
    log(`User ${userId} joined queue for ${genre} (${gameMode})`);
    
    // Check if we can create a match
    await this.tryCreateMatches();
  }

  async leaveQueue(userId: string) {
    await storage.removeFromQueue(userId);
    log(`User ${userId} left queue`);
  }

  private async tryCreateMatches() {
    const genres: Array<"soul" | "funk" | "jazz"> = ["soul", "funk", "jazz"];
    const gameModes: Array<"battle" | "duel"> = ["battle", "duel"];

    for (const genre of genres) {
      for (const gameMode of gameModes) {
        const queue = await storage.getQueueByGenre(genre, gameMode);
        const requiredPlayers = gameMode === "duel" ? 2 : 4;

        if (queue.length >= requiredPlayers) {
          const players = queue.slice(0, requiredPlayers);
          await this.createMatch(genre, players, gameMode);
        }
      }
    }
  }

  private async createMatch(
    genre: "soul" | "funk" | "jazz",
    players: QueuedPlayer[],
    gameMode: "battle" | "duel" = "battle"
  ) {
    try {
      const sample = getRandomSample(genre);

      const match = await storage.createMatch({
        genre,
        gameMode,
        sample: sample.name,
        sampleUrl: sample.url,
      });

      // Add participants
      for (const player of players) {
        await storage.addParticipant({
          matchId: match.id,
          userId: player.userId,
          projectName: "New Project",
        });

        await storage.removeFromQueue(player.userId);
      }

      // Update match status
      await storage.updateMatchStatus(match.id, "active");

      log(`Created match ${match.id} with ${players.length} players, genre: ${genre}`);

      // Broadcast match started to all players
      if (broadcastMatchStarted) {
        broadcastMatchStarted(match.id, players, gameMode);
      }
    } catch (err) {
      log(`Error creating match: ${err}`);
    }
  }
}

export const matchmaker = new Matchmaker();
