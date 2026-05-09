import { NextRequest, NextResponse } from "next/server";
import { ID, Query, Users } from "node-appwrite";
import { getAdminDatabases, getAdminClient } from "@/lib/appwrite-server";
import { Collections } from "@/lib/appwrite";
import type { UserRole } from "@/types/profile.types";

interface CreateUserBody {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  services?: string[];
}

const ALLOWED_ROLES: UserRole[] = ["user", "admin", "unlimited"];
const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/;

function buildDefaultAvatar(seed: string): string {
  const safeSeed = encodeURIComponent(seed.trim() || "qollaby");
  return `https://api.dicebear.com/9.x/initials/png?seed=${safeSeed}&backgroundColor=8b5cf6,3b82f6&textColor=ffffff`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<CreateUserBody>;
    const username = body.username?.trim().toLowerCase() || "";
    const firstName = body.firstName?.trim() || "";
    const lastName = body.lastName?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password ?? "";
    const role = (body.role ?? "user") as UserRole;
    const requestedAvatar = body.avatar?.trim() || "";

    if (!username || !USERNAME_PATTERN.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-32 characters using lowercase letters, digits, dot, dash, or underscore",
        },
        { status: 400 }
      );
    }
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    let avatar = requestedAvatar;
    if (avatar && !/^https?:\/\//i.test(avatar)) {
      return NextResponse.json(
        { error: "Avatar must be a valid http(s) URL" },
        { status: 400 }
      );
    }
    if (!avatar) {
      avatar = buildDefaultAvatar(username);
    }

    // Reject duplicate usernames up front for a clearer error than the Appwrite default.
    const existing = await getAdminDatabases().listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      [Query.equal("username", username), Query.limit(1)]
    );
    if (existing.total > 0) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 409 }
      );
    }

    const users = new Users(getAdminClient());

    let createdUserId: string | null = null;
    try {
      const created = await users.create({
        userId: ID.unique(),
        email,
        password,
        name: `${firstName} ${lastName}`.trim(),
      });
      createdUserId = created.$id;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create auth user";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    try {
      const profile = await getAdminDatabases().createDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.PROFILE,
        ID.unique(),
        {
          userId: createdUserId,
          username,
          firstName,
          lastName,
          email,
          phoneNumber: "",
          avatar,
          hasBusinessProfile: false,
          role,
        }
      );

      return NextResponse.json({ success: true, profile });
    } catch (error: unknown) {
      // Roll back the auth user if profile creation fails so we don't leak orphan accounts.
      try {
        await users.delete(createdUserId);
      } catch (cleanupError) {
        console.error("Failed to rollback auth user:", cleanupError);
      }
      const message =
        error instanceof Error ? error.message : "Failed to create user profile";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
