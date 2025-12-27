export class GameWebSocket {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pendingRegistration: { userId: string; genre: string; gameMode: string } | null = null;
  private onReconnectCallbacks: Set<() => void> = new Set();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        this.ws.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          
          // Re-register if we had a pending registration (reconnection scenario)
          if (this.pendingRegistration) {
            this.send("join_match", this.pendingRegistration);
            console.log("Re-registered for matchmaking after reconnect");
          }
          
          // Notify reconnect callbacks
          this.onReconnectCallbacks.forEach(cb => cb());
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.emit(message.type, message);
          } catch (err) {
            console.error("Failed to parse WebSocket message", err);
          }
        };

        this.ws.onclose = () => {
          console.log("WebSocket disconnected");
          this.attemptReconnect();
        };

        this.ws.onerror = (err) => {
          console.error("WebSocket error", err);
          reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  send(type: string, data: any = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    } else {
      console.warn("WebSocket not connected");
    }
  }

  on(type: string, callback: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  off(type: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(type: string, data: any) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  registerForMatchmaking(userId: string, genre: string, gameMode: string) {
    this.pendingRegistration = { userId, genre, gameMode };
    this.send("join_match", { userId, genre, gameMode });
  }

  clearMatchmakingRegistration() {
    this.pendingRegistration = null;
  }

  onReconnect(callback: () => void) {
    this.onReconnectCallbacks.add(callback);
  }

  offReconnect(callback: () => void) {
    this.onReconnectCallbacks.delete(callback);
  }
}

export const gameWs = new GameWebSocket();
