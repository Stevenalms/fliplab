import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = "/api";

export async function apiCall(
  path: string,
  options?: RequestInit
): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = "API Error";
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      errorMessage = `Server error (${response.status})`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Auth hooks
export function useRegister() {
  return useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      apiCall("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

// Matchmaking hooks
export function useJoinQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; genre: string; gameMode?: string }) =>
      apiCall("/matchmaking/join", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

export function useQueueCount(genre: string | null, gameMode: string = "battle") {
  return useQuery({
    queryKey: ["queue", genre, gameMode],
    queryFn: () => apiCall(`/matchmaking/queue/${genre}?gameMode=${gameMode}`),
    enabled: !!genre,
    refetchInterval: 1000, // Update every second
  });
}

export function useLeaveQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiCall("/matchmaking/leave", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

// Match hooks
export function useMatch(matchId: string | null) {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: () => apiCall(`/matches/${matchId}`),
    enabled: !!matchId,
    refetchInterval: 2000,
  });
}

export function useActiveMatches() {
  return useQuery({
    queryKey: ["matches", "active"],
    queryFn: () => apiCall("/matches/active"),
    refetchInterval: 3000,
  });
}

// Vote hooks
export function useSubmitVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      matchId: string;
      voterId: string;
      flipVoteId?: string;
      drumVoteId?: string;
    }) =>
      apiCall(`/matches/${data.matchId}/vote`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["votes"] });
    },
  });
}

// Leaderboard hooks
export function useLeaderboard(limit = 100) {
  return useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: () => apiCall(`/leaderboard?limit=${limit}`),
    refetchInterval: 5000,
  });
}

export function useUserRank(userId: string | null) {
  return useQuery({
    queryKey: ["rank", userId],
    queryFn: () => apiCall(`/leaderboard/rank/${userId}`),
    enabled: !!userId,
    refetchInterval: 5000,
  });
}

// User hooks
export function useUser(userId: string | null) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => apiCall(`/users/${userId}`),
    enabled: !!userId,
    refetchInterval: 5000,
  });
}

// Draft hooks
export function useDrafts(userId: string | null) {
  return useQuery({
    queryKey: ["drafts", userId],
    queryFn: () => apiCall(`/drafts/${userId}`),
    enabled: !!userId,
  });
}

export function useCreateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      userId: string;
      name: string;
      sampleId: string;
      genre: string;
      bpm?: number;
      drumPattern?: any;
      effectSettings?: any;
    }) =>
      apiCall("/drafts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

export function useUpdateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; userId: string; updates: any }) =>
      apiCall(`/drafts/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({ userId: data.userId, ...data.updates }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; userId: string }) =>
      apiCall(`/drafts/${data.id}`, {
        method: "DELETE",
        body: JSON.stringify({ userId: data.userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}
