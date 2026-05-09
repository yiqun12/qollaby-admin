import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabases } from "@/lib/appwrite-server";
import { Collections } from "@/lib/appwrite";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId } = await params;

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    await getAdminDatabases().deleteDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      profileId
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting user profile:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete user profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
