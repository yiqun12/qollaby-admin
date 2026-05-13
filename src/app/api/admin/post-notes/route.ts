import { NextRequest, NextResponse } from "next/server";
import { Collections } from "@/lib/appwrite";
import { getAdminDatabases } from "@/lib/appwrite-server";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

/**
 * Updates optional `adminNotes` on a post or exchange listing (Appwrite string attribute).
 * Create attribute `adminNotes` (string, size 10000) on `posts` and `exchange_listings` if missing.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const notes = typeof body?.notes === "string" ? body.notes : "";
    const kind = body?.kind === "exchange" ? "exchange" : "post";

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const collectionId =
      kind === "exchange"
        ? Collections.EXCHANGE_LISTINGS
        : Collections.POSTS;

    const db = getAdminDatabases();
    await db.updateDocument(DATABASE_ID, collectionId, id, {
      adminNotes: notes,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[post-notes]", error);
    const message =
      error instanceof Error ? error.message : "Failed to save admin notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
