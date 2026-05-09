import { NextRequest, NextResponse } from "next/server";
import {
  queryPostReports,
  queryPostsLikeCounts,
  queryPostsReportCounts,
  queryPostsStampCounts,
} from "@/lib/post-stats-queries";

/**
 * Batch (and optional single-post detail) stats using APPWRITE_API_KEY.
 * Used by Posts UI instead of Server Actions so behavior matches other /api/admin/* routes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const postIds: unknown = body?.postIds;
    const includeReportsForPostId: string | undefined =
      typeof body?.includeReportsForPostId === "string"
        ? body.includeReportsForPostId
        : undefined;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: "postIds must be a non-empty array of strings" },
        { status: 400 }
      );
    }

    const ids = postIds.filter((id): id is string => typeof id === "string");
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "postIds must contain valid strings" },
        { status: 400 }
      );
    }

    const [likes, stamps, reportCounts] = await Promise.all([
      queryPostsLikeCounts(ids),
      queryPostsStampCounts(ids),
      queryPostsReportCounts(ids),
    ]);

    let reports: Awaited<ReturnType<typeof queryPostReports>> | undefined;
    if (includeReportsForPostId) {
      if (!ids.includes(includeReportsForPostId)) {
        return NextResponse.json(
          { error: "includeReportsForPostId must be one of postIds" },
          { status: 400 }
        );
      }
      reports = await queryPostReports(includeReportsForPostId);
    }

    return NextResponse.json({
      likes,
      stamps,
      reportCounts,
      reports: reports ?? null,
    });
  } catch (error: unknown) {
    console.error("[post-stats]", error);
    const message =
      error instanceof Error ? error.message : "Failed to load post stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
