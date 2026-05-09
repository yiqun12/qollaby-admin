import { Query } from "node-appwrite";
import { Collections } from "./appwrite";
import { getAdminDatabases } from "./appwrite-server";
import type { Report } from "./user-actions";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function queryPostsLikeCounts(
  postIds: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (postIds.length === 0) return result;

  const db = getAdminDatabases();
  const res = await db.listDocuments(
    DATABASE_ID,
    Collections.POST_LIKES,
    [Query.equal("postId", postIds), Query.limit(5000)]
  );
  postIds.forEach((id) => {
    result[id] = 0;
  });
  res.documents.forEach((doc) => {
    const pid = doc.postId as string;
    result[pid] = (result[pid] || 0) + 1;
  });
  return result;
}

export async function queryPostsStampCounts(
  postIds: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (postIds.length === 0) return result;

  const db = getAdminDatabases();
  const res = await db.listDocuments(
    DATABASE_ID,
    Collections.POST_STAMPS,
    [Query.equal("postId", postIds), Query.limit(5000)]
  );
  postIds.forEach((id) => {
    result[id] = 0;
  });
  res.documents.forEach((doc) => {
    const pid = doc.postId as string;
    result[pid] = (result[pid] || 0) + 1;
  });
  return result;
}

export async function queryPostsReportCounts(
  postIds: string[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (postIds.length === 0) return result;

  const db = getAdminDatabases();
  const res = await db.listDocuments(
    DATABASE_ID,
    Collections.REPORTS,
    [Query.equal("postId", postIds), Query.limit(5000)]
  );
  postIds.forEach((id) => {
    result[id] = 0;
  });
  res.documents.forEach((doc) => {
    const pid = doc.postId as string;
    result[pid] = (result[pid] || 0) + 1;
  });
  return result;
}

export async function queryPostReports(postId: string): Promise<Report[]> {
  const db = getAdminDatabases();
  const res = await db.listDocuments(
    DATABASE_ID,
    Collections.REPORTS,
    [Query.equal("postId", postId), Query.orderDesc("$createdAt"), Query.limit(100)]
  );
  return res.documents as unknown as Report[];
}
