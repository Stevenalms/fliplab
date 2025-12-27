import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { matchmaker, userSocketMap, setBroadcastMatchStarted } from "./matchmaking";
import { log } from "./index";
import { WebSocketServer } from "ws";
import { insertUserSchema, insertVoteSchema, insertDraftSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

const activeConnections = new Map<string, any>();
const matchConnections = new Map<string, Set<string>>(); // matchId -> Set<socketId>
const userIdToSocketIds = new Map<string, Set<string>>(); // userId -> Set<socketId> (supports multiple devices)
const socketIdToUserId = new Map<string, string>(); // socketId -> userId (for cleanup on disconnect)
const activeMatchTimers = new Map<string, NodeJS.Timeout>(); // matchId -> timer interval

const MATCH_DURATION = 600; // 10 minutes in seconds

async function startMatchTimer(matchId: string, gameMode: string) {
  // Clear any existing timer for this match
  if (activeMatchTimers.has(matchId)) {
    clearInterval(activeMatchTimers.get(matchId)!);
  }

  // Get the match to read its startTime
  const match = await storage.getMatch(matchId);
  if (!match || !match.startTime) {
    log(`Cannot start timer for match ${matchId}: no startTime`);
    return;
  }
  
  const startTime = new Date(match.startTime).getTime();
  
  const timer = setInterval(async () => {
    // Calculate remaining time from persisted startTime
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remainingSeconds = Math.max(0, MATCH_DURATION - elapsed);
    
    // Broadcast time sync every 5 seconds to all players
    if (remainingSeconds % 5 === 0 || remainingSeconds <= 10) {
      broadcastToMatch(matchId, {
        type: "time_sync",
        remainingSeconds,
        serverTime: Date.now(),
      });
    }
    
    // Match ended
    if (remainingSeconds <= 0) {
      clearInterval(timer);
      activeMatchTimers.delete(matchId);
      
      const nextStatus = gameMode === "duel" ? "showcase" : "voting";
      await storage.updateMatchStatus(matchId, nextStatus);
      
      broadcastToMatch(matchId, {
        type: "match_ended",
        destination: gameMode === "duel" ? "showcase" : "voting",
        gameMode,
      });
      
      log(`Match ${matchId} ended, transitioning to ${nextStatus}`);
    }
  }, 1000);
  
  activeMatchTimers.set(matchId, timer);
  log(`Started server timer for match ${matchId} (${MATCH_DURATION}s from startTime)`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Start matchmaker
  matchmaker.start();

  // Set up broadcast callback for when matches are created
  setBroadcastMatchStarted((matchId, players, gameMode) => {
    // Start server-side timer for this match
    startMatchTimer(matchId, gameMode);
    
    for (const player of players) {
      const socketIds = userIdToSocketIds.get(player.userId);
      if (socketIds) {
        Array.from(socketIds).forEach(socketId => {
          const ws = activeConnections.get(socketId);
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: "match_started",
              matchId: matchId,
              gameMode: gameMode,
              remainingSeconds: MATCH_DURATION,
              serverTime: Date.now(),
            }));
            log(`Notified player ${player.userId} via socket ${socketId} about match ${matchId} (${gameMode})`);
          }
        });
      }
    }
  });

  // Register object storage routes for drum pack uploads
  registerObjectStorageRoutes(app);

  // WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        const socketId = Math.random().toString(36).slice(2);
        activeConnections.set(socketId, ws);

        log(`WebSocket connected: ${socketId}`);

        ws.on("message", async (data) => {
          try {
            const message = JSON.parse(data.toString());
            await handleWebSocketMessage(socketId, message, ws);
          } catch (err) {
            log(`WebSocket message error: ${err}`);
          }
        });

        ws.on("close", () => {
          activeConnections.delete(socketId);
          // Clean up from matchConnections
          matchConnections.forEach((sockets, matchId) => {
            if (sockets.has(socketId)) {
              sockets.delete(socketId);
              if (sockets.size === 0) {
                matchConnections.delete(matchId);
              }
            }
          });
          // Clean up from userIdToSocketIds
          const userId = socketIdToUserId.get(socketId);
          if (userId) {
            const userSockets = userIdToSocketIds.get(userId);
            if (userSockets) {
              userSockets.delete(socketId);
              if (userSockets.size === 0) {
                userIdToSocketIds.delete(userId);
              }
            }
            socketIdToUserId.delete(socketId);
          }
          log(`WebSocket disconnected: ${socketId}`);
        });
      });
    }
  });

  // Authentication Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      
      if (!parsed.success) {
        const errors = parsed.error.errors.map((e) => {
          if (e.path[0] === "username") {
            return "Username must be 3-20 characters";
          }
          if (e.path[0] === "password") {
            return "Password must be at least 6 characters";
          }
          return e.message;
        });
        return res.status(400).json({ message: errors[0] || "Invalid input" });
      }

      const { username, password } = parsed.data;

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const user = await storage.createUser({ username, password });
      res.json({ user });
      log(`User registered: ${username}`);
    } catch (err: any) {
      log(`Registration error: ${err?.message || err}`);
      log(`Registration error stack: ${err?.stack}`);
      res.status(500).json({ message: err?.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        log(`Login failed: missing username or password`);
        return res.status(400).json({ message: "Username and password required" });
      }
      
      log(`Login attempt for username: "${username}"`);
      const user = await storage.getUserByUsername(username);

      if (!user) {
        log(`Login failed: user "${username}" not found`);
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      if (user.password !== password) {
        log(`Login failed: wrong password for user "${username}"`);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      res.json({ user });
      log(`User logged in: ${username}`);
    } catch (err: any) {
      log(`Login error: ${err?.message || err}`);
      log(`Login error stack: ${err?.stack}`);
      res.status(500).json({ message: err?.message || "Login failed" });
    }
  });
  
  app.get("/api/auth/verify/:userId", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ valid: false, message: "User not found" });
      }
      res.json({ valid: true, user: { id: user.id, username: user.username } });
    } catch (err) {
      log(`Verify error: ${err}`);
      res.status(500).json({ valid: false, message: "Verification failed" });
    }
  });

  app.post("/api/auth/enter", async (req, res) => {
    try {
      const { nickname } = req.body;
      
      if (!nickname || typeof nickname !== "string") {
        return res.status(400).json({ message: "Nickname required" });
      }
      
      const trimmed = nickname.trim();
      if (trimmed.length < 2 || trimmed.length > 20) {
        return res.status(400).json({ message: "Nickname must be 2-20 characters" });
      }

      let user = await storage.getUserByUsername(trimmed);
      
      if (!user) {
        user = await storage.createUser({ username: trimmed, password: "" });
        log(`New player entered: ${trimmed}`);
      } else {
        log(`Player returned: ${trimmed}`);
      }

      res.json({ user: { id: user.id, username: user.username } });
    } catch (err: any) {
      log(`Enter error: ${err?.message || err}`);
      res.status(500).json({ message: "Failed to enter" });
    }
  });

  // Matchmaking Routes
  app.post("/api/matchmaking/join", async (req, res) => {
    try {
      const { userId, genre, gameMode = "battle" } = req.body;
      log(`Join queue request: userId=${userId}, genre=${genre}, gameMode=${gameMode}`);
      await matchmaker.joinQueue(userId, genre, gameMode);
      const queueAfter = await storage.getQueueByGenre(genre, gameMode);
      log(`Queue after join: ${queueAfter.length} players for ${genre} (${gameMode})`);
      res.json({ status: "joined" });
    } catch (err) {
      log(`Error joining queue: ${err}`);
      res.status(500).json({ message: "Error joining queue" });
    }
  });

  app.post("/api/matchmaking/leave", async (req, res) => {
    try {
      const { userId } = req.body;
      await matchmaker.leaveQueue(userId);
      res.json({ status: "left" });
    } catch (err) {
      res.status(500).json({ message: "Error leaving queue" });
    }
  });

  // Get queue count by genre and mode
  app.get("/api/matchmaking/queue/:genre", async (req, res) => {
    try {
      const { genre } = req.params;
      const gameMode = (req.query.gameMode as string) || "battle";
      const queuedPlayers = await storage.getQueueByGenre(genre, gameMode);
      log(`Queue check: ${genre} (${gameMode}) = ${queuedPlayers.length} players`);
      res.json({ count: queuedPlayers.length, players: queuedPlayers });
    } catch (err) {
      log(`Error fetching queue: ${err}`);
      res.status(500).json({ message: "Error fetching queue" });
    }
  });

  // Match Routes
  app.get("/api/matches/:id", async (req, res) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      const participants = await storage.getMatchParticipants(match.id);
      
      // Calculate remaining time from server
      const MATCH_DURATION = 600; // 10 minutes in seconds
      let remainingSeconds = MATCH_DURATION;
      
      if (match.startTime) {
        const elapsed = Math.floor((Date.now() - new Date(match.startTime).getTime()) / 1000);
        remainingSeconds = Math.max(0, MATCH_DURATION - elapsed);
      }
      
      res.json({ match, participants, remainingSeconds, serverTime: Date.now() });
    } catch (err) {
      res.status(500).json({ message: "Error fetching match" });
    }
  });

  app.get("/api/matches/active", async (req, res) => {
    try {
      const matches = await storage.getActiveMatches();
      res.json({ matches });
    } catch (err) {
      res.status(500).json({ message: "Error fetching matches" });
    }
  });

  app.get("/api/matches/user/:userId/active", async (req, res) => {
    try {
      const { userId } = req.params;
      const match = await storage.getUserActiveMatch(userId);
      if (!match) {
        return res.json({ match: null });
      }
      res.json({ match });
    } catch (err) {
      log(`Error fetching user active match: ${err}`);
      res.status(500).json({ message: "Error fetching user match" });
    }
  });

  // Voting Routes
  app.post("/api/matches/:matchId/vote", async (req, res) => {
    try {
      const { matchId } = req.params;
      const { voterId, flipVoteId } = insertVoteSchema.parse({
        matchId,
        ...req.body,
      });

      const vote = await storage.submitVote({
        matchId,
        voterId,
        flipVoteId,
      });

      // Get participants to check if anyone left mid-round
      const participants = await storage.getMatchParticipants(matchId);
      const playerLeftMidRound = participants.length < 4;

      // Award points to the winner
      const pointsAwarded = playerLeftMidRound ? 12 : 14;
      const user = await storage.getUser(flipVoteId);
      if (user) {
        const updatedRating = (user.rating || 1000) + pointsAwarded;
        await storage.updateUserStats(flipVoteId, {
          wins: (user.wins || 0) + 1,
          rating: updatedRating,
        });
        await storage.updateLeaderboard(flipVoteId);
      }

      // Broadcast vote update to all players in match
      broadcastToMatch(matchId, {
        type: "vote_submitted",
        voterId,
        winner: flipVoteId,
        pointsAwarded,
      });

      res.json({ vote, pointsAwarded });
      log(`Vote submitted in match ${matchId}: ${flipVoteId} wins ${pointsAwarded} points`);
    } catch (err) {
      res.status(400).json({ message: "Invalid vote" });
    }
  });

  // Leaderboard Routes
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const leaderboard = await storage.getLeaderboard(limit);
      res.json({ leaderboard });
    } catch (err) {
      res.status(500).json({ message: "Error fetching leaderboard" });
    }
  });

  app.get("/api/leaderboard/rank/:userId", async (req, res) => {
    try {
      const rank = await storage.getUserRank(req.params.userId);
      res.json({ rank });
    } catch (err) {
      res.status(500).json({ message: "Error fetching rank" });
    }
  });

  // User Routes
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (err) {
      res.status(500).json({ message: "Error fetching user" });
    }
  });

  // Draft Routes
  app.get("/api/drafts/:userId", async (req, res) => {
    try {
      const drafts = await storage.getDraftsByUser(req.params.userId);
      res.json({ drafts });
    } catch (err) {
      res.status(500).json({ message: "Error fetching drafts" });
    }
  });

  app.post("/api/drafts", async (req, res) => {
    try {
      const parsed = insertDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid draft data" });
      }
      const draft = await storage.createDraft(parsed.data);
      res.json({ draft });
      log(`Draft created: ${draft.name} by user ${draft.userId}`);
    } catch (err) {
      log(`Error creating draft: ${err}`);
      res.status(500).json({ message: "Error creating draft" });
    }
  });

  app.put("/api/drafts/:id", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const draft = await storage.getDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }
      if (draft.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this draft" });
      }
      
      await storage.updateDraft(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error updating draft" });
    }
  });

  app.delete("/api/drafts/:id", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const draft = await storage.getDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }
      if (draft.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this draft" });
      }
      
      await storage.deleteDraft(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error deleting draft" });
    }
  });

  return httpServer;
}

async function handleWebSocketMessage(socketId: string, message: any, ws: any) {
  switch (message.type) {
    case "join_match":
      const userId = message.userId;
      const genre = message.genre;
      // Store userId -> socketId mapping so matchmaker can notify players (supports multiple devices)
      if (!userIdToSocketIds.has(userId)) {
        userIdToSocketIds.set(userId, new Set());
      }
      userIdToSocketIds.get(userId)!.add(socketId);
      socketIdToUserId.set(socketId, userId);
      log(`Socket ${socketId} joined match queue for user ${userId}, genre: ${genre}`);
      break;

    case "join_studio":
      // Register this socket to the match for time sync broadcasts
      const studioMatchId = message.matchId;
      const studioUserId = message.userId;
      
      if (!matchConnections.has(studioMatchId)) {
        matchConnections.set(studioMatchId, new Set());
      }
      matchConnections.get(studioMatchId)!.add(socketId);
      if (!userIdToSocketIds.has(studioUserId)) {
        userIdToSocketIds.set(studioUserId, new Set());
      }
      userIdToSocketIds.get(studioUserId)!.add(socketId);
      socketIdToUserId.set(socketId, studioUserId);
      
      // Send immediate time sync on join
      const studioMatch = await storage.getMatch(studioMatchId);
      if (studioMatch?.startTime) {
        const elapsed = Math.floor((Date.now() - new Date(studioMatch.startTime).getTime()) / 1000);
        const remainingSeconds = Math.max(0, MATCH_DURATION - elapsed);
        ws.send(JSON.stringify({
          type: "time_sync",
          remainingSeconds,
          serverTime: Date.now(),
        }));
      }
      
      log(`Socket ${socketId} joined studio for match ${studioMatchId}`);
      break;

    case "player_ready":
      broadcastToMatch(message.matchId, {
        type: "player_ready",
        userId: message.userId,
      });
      break;

    case "time_update":
      broadcastToMatch(message.matchId, {
        type: "time_update",
        timeLeft: message.timeLeft,
      });
      break;

    case "match_end":
      // Get match to determine game mode for proper routing
      const endMatch = await storage.getMatch(message.matchId);
      const endGameMode = endMatch?.gameMode || "battle";
      const endStatus = endGameMode === "duel" ? "showcase" : "voting";
      
      await storage.updateMatchStatus(message.matchId, endStatus);
      
      // Clear any running timer for this match
      if (activeMatchTimers.has(message.matchId)) {
        clearInterval(activeMatchTimers.get(message.matchId)!);
        activeMatchTimers.delete(message.matchId);
      }
      
      broadcastToMatch(message.matchId, {
        type: "match_ended",
        destination: endStatus,
        gameMode: endGameMode,
      });
      break;

    default:
      log(`Unknown message type: ${message.type}`);
  }
}

function broadcastToMatch(matchId: string, message: any) {
  const sockets = matchConnections.get(matchId);
  if (sockets) {
    const data = JSON.stringify(message);
    sockets.forEach((socketId) => {
      const ws = activeConnections.get(socketId);
      if (ws && ws.readyState === 1) {
        ws.send(data);
      }
    });
  }
}
