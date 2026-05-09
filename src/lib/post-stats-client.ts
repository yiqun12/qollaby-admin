import type { Report } from "./user-actions";

export type PostStatsApiResponse = {
  likes: Record<string, number>;
  stamps: Record<string, number>;
  reportCounts: Record<string, number>;
  reports: Report[] | null;
};

/**
 * Loads like/stamp/report aggregates via /api/admin/post-stats (APPWRITE_API_KEY on server).
 */
export async function fetchPostStatsApi(params: {
  postIds: string[];
  includeReportsForPostId?: string;
}): Promise<PostStatsApiResponse> {
  const res = await fetch("/api/admin/post-stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postIds: params.postIds,
      ...(params.includeReportsForPostId
        ? { includeReportsForPostId: params.includeReportsForPostId }
        : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<PostStatsApiResponse>;
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Failed to load post stats"
    );
  }
  return data as PostStatsApiResponse;
}
