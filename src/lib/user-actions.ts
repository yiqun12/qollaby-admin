import { Profile, UserContentStats, UserRole, UserSubscriptionInfo } from "@/types/profile.types";
import { mergeSocialLinksFromDoc, type SocialLinksPayload } from "@/lib/social-links";
import { Collections, databases, Query } from "./appwrite";
import { ID } from "appwrite";

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | "all";
  planId?: string | "all" | "none"; // "none" = no subscription
  hasBusinessProfile?: "all" | "yes" | "no";
  state?: string;
  city?: string;
  category?: string;
}

export interface UserListResult {
  users: Profile[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Get paginated list of users with optional search, role, and subscription filter
 */
export async function getUsers(params: UserListParams = {}): Promise<UserListResult> {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    role = "all", 
    planId = "all",
    hasBusinessProfile = "all",
    state,
    city,
    category,
  } = params;
  const offset = (page - 1) * limit;

  try {
    // Collect user IDs from various filters
    let filteredUserIds: Set<string> | null = null;

    // Filter by subscription
    if (planId !== "all") {
      if (planId === "none") {
        const allSubsRes = await databases.listDocuments(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          Collections.SUBSCRIPTIONS,
          [Query.limit(1000)]
        );
        const usersWithSubs = new Set(allSubsRes.documents.map((d) => d.userId as string));
        
        const allUsersRes = await databases.listDocuments(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          Collections.PROFILE,
          [Query.limit(1000)]
        );
        const noSubUserIds = new Set(
          allUsersRes.documents
            .filter((u) => !usersWithSubs.has(u.userId as string))
            .map((u) => u.userId as string)
        );
        filteredUserIds = filteredUserIds 
          ? new Set([...filteredUserIds].filter(id => noSubUserIds.has(id)))
          : noSubUserIds;
      } else {
        const subsRes = await databases.listDocuments(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          Collections.SUBSCRIPTIONS,
          [Query.equal("planId", planId), Query.limit(1000)]
        );
        const subUserIds = new Set(subsRes.documents.map((d) => d.userId as string));
        filteredUserIds = filteredUserIds
          ? new Set([...filteredUserIds].filter(id => subUserIds.has(id)))
          : subUserIds;
      }
    }

    // Filter by business profile fields (state, city, category) or hasBusinessProfile
    const needsBusinessProfileFilter = hasBusinessProfile !== "all" || state || city || category;
    
    if (needsBusinessProfileFilter) {
      const bpQueries: string[] = [Query.limit(1000)];
      if (state) bpQueries.push(Query.contains("locationAddress", state));
      if (city) bpQueries.push(Query.contains("locationAddress", city));
      if (category) bpQueries.push(Query.equal("category", category));

      const bpRes = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.BUSINESS_PROFILE,
        bpQueries
      );
      const bpUserIds = new Set(bpRes.documents.map((d) => d.userId as string));

      if (hasBusinessProfile === "yes" || state || city || category) {
        // Only users with matching business profile
        filteredUserIds = filteredUserIds
          ? new Set([...filteredUserIds].filter(id => bpUserIds.has(id)))
          : bpUserIds;
      } else if (hasBusinessProfile === "no") {
        // Only users without business profile
        const allUsersRes = await databases.listDocuments(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          Collections.PROFILE,
          [Query.limit(1000)]
        );
        const allBpRes = await databases.listDocuments(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          Collections.BUSINESS_PROFILE,
          [Query.limit(1000)]
        );
        const allBpUserIds = new Set(allBpRes.documents.map((d) => d.userId as string));
        const noBpUserIds = new Set(
          allUsersRes.documents
            .filter((u) => !allBpUserIds.has(u.userId as string))
            .map((u) => u.userId as string)
        );
        filteredUserIds = filteredUserIds
          ? new Set([...filteredUserIds].filter(id => noBpUserIds.has(id)))
          : noBpUserIds;
      }
    }

    const queries: string[] = [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ];

    const countQueries: string[] = [];

    // Add role filter
    if (role !== "all") {
      queries.push(Query.equal("role", role));
      countQueries.push(Query.equal("role", role));
    }

    // Add search filter (search by name or email)
    if (search && search.trim()) {
      queries.push(Query.contains("firstName", search.trim()));
      countQueries.push(Query.contains("firstName", search.trim()));
    }

    // Add filtered user IDs
    if (filteredUserIds !== null) {
      if (filteredUserIds.size === 0) {
        return { users: [], total: 0, page, totalPages: 0 };
      }
      const userIdsArray = [...filteredUserIds];
      queries.push(Query.equal("userId", userIdsArray));
      countQueries.push(Query.equal("userId", userIdsArray));
    }

    const [usersRes, totalRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.PROFILE,
        queries
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.PROFILE,
        countQueries.length > 0 ? countQueries : [Query.limit(1)]
      ),
    ]);

    return {
      users: usersRes.documents as unknown as Profile[],
      total: totalRes.total,
      page,
      totalPages: Math.ceil(totalRes.total / limit),
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

/**
 * Filter options for users list
 */
export interface UserFilterOptions {
  states: string[];
  cities: string[];
  categories: string[];
}

/**
 * Get available filter options from business profiles
 */
export async function getUserFilterOptions(): Promise<UserFilterOptions> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.BUSINESS_PROFILE,
      [Query.limit(1000)]
    );

    const states = new Set<string>();
    const cities = new Set<string>();
    const categories = new Set<string>();

    for (const doc of res.documents) {
      const bp = doc as unknown as BusinessProfile;
      
      // Parse location address for state and city
      if (bp.locationAddress) {
        const parts = bp.locationAddress.split(",").map((p) => p.trim());
        if (parts.length >= 3) {
          const state = parts[parts.length - 2];
          const city = parts[parts.length - 3];
          if (state && state !== "USA") states.add(state);
          if (city) cities.add(city);
        }
      }
      
      if (bp.category) categories.add(bp.category);
    }

    return {
      states: [...states].sort(),
      cities: [...cities].sort(),
      categories: [...categories].sort(),
    };
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return { states: [], cities: [], categories: [] };
  }
}

/**
 * Get single user by profile document ID
 */
export async function getUserById(profileId: string): Promise<Profile | null> {
  try {
    const doc = await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      profileId
    );
    return doc as unknown as Profile;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

/**
 * Get user by userId field
 */
export async function getUserByUserId(userId: string): Promise<Profile | null> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      [Query.equal("userId", userId), Query.limit(1)]
    );
    return (res.documents[0] as unknown as Profile) || null;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

/**
 * Business Profile type
 */
export interface BusinessProfile {
  $id: string;
  userId: string;
  businessName?: string;
  locationAddress?: string;
  category?: string;
  subCategory?: string;
  /** Text JSON or object — merged social URLs */
  socialLinks?: string | Record<string, string>;
  storeFront?: string;
  /** Legacy columns (until removed in Appwrite) */
  website?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  twitter?: string;
  tiktok?: string;
  $createdAt: string;
  $updatedAt: string;
}

/**
 * Parsed Business Profile for display
 */
export interface ParsedBusinessProfile {
  userId: string;
  ownerName: string;
  ownerEmail: string;
  state: string;
  city: string;
  category: string;
  subcategory: string;
}

/**
 * Parse location address to extract city and state
 * Format: "Testarossa Winery, College Avenue, Los Gatos, CA, USA"
 */
function parseLocationAddress(locationAddress: string | undefined): { city: string; state: string } {
  if (!locationAddress) {
    return { city: "N/A", state: "N/A" };
  }

  const parts = locationAddress.split(",").map((p) => p.trim());
  
  // Typical format: "Business, Street, City, State, Country"
  // We want the second-to-last (State) and third-to-last (City)
  if (parts.length >= 3) {
    // State is usually the second to last part (e.g., "CA")
    const state = parts[parts.length - 2] || "N/A";
    // City is usually the third to last part (e.g., "Los Gatos")
    const city = parts[parts.length - 3] || "N/A";
    return { city, state };
  } else if (parts.length === 2) {
    return { city: parts[0], state: parts[1] };
  } else {
    return { city: locationAddress, state: "N/A" };
  }
}

/**
 * Get user's business profile
 */
export async function getUserBusinessProfile(
  userId: string,
  userProfile: Profile
): Promise<ParsedBusinessProfile | null> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.BUSINESS_PROFILE,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    if (res.documents.length === 0) {
      return null;
    }

    const businessProfile = res.documents[0] as unknown as BusinessProfile;
    const { city, state } = parseLocationAddress(businessProfile.locationAddress);

    return {
      userId: businessProfile.userId,
      ownerName: `${userProfile.firstName} ${userProfile.lastName}`.trim() || "N/A",
      ownerEmail: userProfile.email || "N/A",
      state,
      city,
      category: businessProfile.category || "N/A",
      subcategory: businessProfile.subCategory || "N/A",
    };
  } catch (error) {
    console.error("Error fetching business profile:", error);
    return null;
  }
}

/**
 * Business Profile data for list display
 */
export interface BusinessProfileListItem {
  odooId: string;
  ownerName: string;
  ownerEmail: string;
  userId: string;
  state: string;
  city: string;
  category: string;
  subcategory: string;
}

/**
 * Get business profiles for multiple users (batch)
 */
export async function getUsersBusinessProfiles(
  users: Profile[]
): Promise<Map<string, BusinessProfileListItem>> {
  const result = new Map<string, BusinessProfileListItem>();

  if (users.length === 0) {
    return result;
  }

  // Create a map of userId -> user profile for quick lookup
  const userMap = new Map<string, Profile>();
  users.forEach((u) => userMap.set(u.userId, u));

  const userIds = users.map((u) => u.userId);

  try {
    // Fetch business profiles for all users
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.BUSINESS_PROFILE,
      [Query.equal("userId", userIds), Query.limit(1000)]
    );

    for (const doc of res.documents) {
      const bp = doc as unknown as BusinessProfile;
      const { city, state } = parseLocationAddress(bp.locationAddress);
      const user = userMap.get(bp.userId);

      result.set(bp.userId, {
        odooId: bp.$id,
        ownerName: user ? `${user.firstName} ${user.lastName}`.trim() : "N/A",
        ownerEmail: user?.email || "N/A",
        userId: bp.userId,
        state,
        city,
        category: bp.category || "N/A",
        subcategory: bp.subCategory || "N/A",
      });
    }

    return result;
  } catch (error) {
    console.error("Error fetching business profiles:", error);
    return result;
  }
}

export type AdminBusinessProfileInfo = {
  documentId: string;
  businessName?: string;
  phone?: string;
  storeFront?: string;
  socialLinks: SocialLinksPayload;
};

/**
 * Business profile public links + store (for admin user detail UI).
 */
export async function getAdminBusinessProfileByUserId(
  userId: string
): Promise<AdminBusinessProfileInfo | null> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.BUSINESS_PROFILE,
      [Query.equal("userId", userId), Query.limit(1)]
    );
    if (res.documents.length === 0) return null;
    const doc = res.documents[0] as unknown as Record<string, unknown>;
    return {
      documentId: String(doc.$id ?? ""),
      businessName: doc.businessName as string | undefined,
      phone: doc.phone as string | undefined,
      storeFront: (doc.storeFront as string | undefined) || undefined,
      socialLinks: mergeSocialLinksFromDoc(doc),
    };
  } catch (error) {
    console.error("Error fetching admin business profile:", error);
    return null;
  }
}

/**
 * Update user role (set/remove admin)
 */
export async function updateUserRole(profileId: string, role: UserRole): Promise<Profile> {
  try {
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      profileId,
      { role }
    );
    return doc as unknown as Profile;
  } catch (error) {
    console.error("Error updating user role:", error);
    throw error;
  }
}

/**
 * Delete user profile via server-side API route (requires APPWRITE_API_KEY)
 */
export async function deleteUserProfile(profileId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${profileId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete user profile");
  }
}

/**
 * Input for creating a new user via the admin API.
 * `services` is currently UI-only metadata; not persisted to the schema.
 */
export interface CreateUserInput {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  services?: string[];
}

/**
 * Create a new user (auth account + profile document) via server-side API route.
 */
export async function createUser(input: CreateUserInput): Promise<Profile> {
  const res = await fetch(`/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to create user");
  }
  return data.profile as Profile;
}

/**
 * Get user statistics
 */
export async function getUserStats(): Promise<{
  totalUsers: number;
  totalAdmins: number;
  recentUsers: number;
}> {
  try {
    // Get date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalRes, adminRes, recentRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.PROFILE,
        [Query.limit(1)]
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.PROFILE,
        [Query.equal("role", "admin"), Query.limit(1)]
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.PROFILE,
        [Query.greaterThan("$createdAt", sevenDaysAgo.toISOString()), Query.limit(1)]
      ),
    ]);

    return {
      totalUsers: totalRes.total,
      totalAdmins: adminRes.total,
      recentUsers: recentRes.total,
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return { totalUsers: 0, totalAdmins: 0, recentUsers: 0 };
  }
}

/**
 * Get user subscription info (plan name, expiry date, expired status)
 */
export async function getUserSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo> {
  try {
    // Get user's latest subscription
    const subscriptionRes = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SUBSCRIPTIONS,
      [
        Query.equal("userId", userId),
        Query.orderDesc("$createdAt"),
        Query.limit(1),
      ]
    );

    if (subscriptionRes.documents.length === 0) {
      return {
        hasSubscription: false,
        planName: null,
        expiresAt: null,
        isExpired: false,
      };
    }

    const subscription = subscriptionRes.documents[0];
    const expiresAt = subscription.currentPeriodEnd as string | null;
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

    // Get plan name
    let planName: string | null = null;
    if (subscription.planId) {
      try {
        const planDoc = await databases.getDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          Collections.PLANS,
          subscription.planId as string
        );
        planName = (planDoc.name as string) || null;
      } catch {
        // Plan not found, keep planName as null
      }
    }

    return {
      hasSubscription: true,
      planName,
      expiresAt,
      isExpired,
    };
  } catch (error) {
    console.error("Error fetching user subscription:", error);
    return {
      hasSubscription: false,
      planName: null,
      expiresAt: null,
      isExpired: false,
    };
  }
}

/**
 * Get user content stats (post count and ad count)
 */
export async function getUserContentStats(userId: string): Promise<UserContentStats> {
  try {
    const [postsRes, adsRes] = await Promise.all([
      // Get post count (type = "post")
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.POSTS,
        [
          Query.equal("userId", userId),
          Query.equal("type", "post"),
          Query.limit(1),
        ]
      ),
      // Get ad count
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        [
          Query.equal("userId", userId),
          Query.limit(1),
        ]
      ),
    ]);

    return {
      postCount: postsRes.total,
      adCount: adsRes.total,
    };
  } catch (error) {
    console.error("Error fetching user content stats:", error);
    return {
      postCount: 0,
      adCount: 0,
    };
  }
}

/**
 * Plan type for dropdown filter
 */
export interface Plan {
  id: string;
  name: string;
}

/**
 * Get all subscription plans (for dropdown filter)
 */
export async function getPlans(): Promise<Plan[]> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PLANS,
      [Query.orderAsc("name"), Query.limit(100)]
    );
    return res.documents.map((doc) => ({
      id: doc.$id,
      name: (doc.name as string) || "Unknown Plan",
    }));
  } catch (error) {
    console.error("Error fetching plans:", error);
    return [];
  }
}

/**
 * Batch get subscription info for multiple users
 */
export async function getUsersSubscriptionInfo(
  userIds: string[]
): Promise<Map<string, UserSubscriptionInfo>> {
  const result = new Map<string, UserSubscriptionInfo>();

  if (userIds.length === 0) return result;

  try {
    // Get all subscriptions for these users
    const subscriptionsRes = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SUBSCRIPTIONS,
      [
        Query.equal("userId", userIds),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]
    );

    // Get unique plan IDs
    const planIds = [
      ...new Set(
        subscriptionsRes.documents
          .map((doc) => doc.planId as string)
          .filter(Boolean)
      ),
    ];

    // Fetch all plans at once
    const plansMap = new Map<string, string>();
    if (planIds.length > 0) {
      const plansRes = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.PLANS,
        [Query.equal("$id", planIds), Query.limit(100)]
      );
      plansRes.documents.forEach((doc) => {
        plansMap.set(doc.$id, (doc.name as string) || "Unknown Plan");
      });
    }

    // Group subscriptions by userId (take the latest one)
    const userSubscriptions = new Map<string, typeof subscriptionsRes.documents[0]>();
    subscriptionsRes.documents.forEach((sub) => {
      const uid = sub.userId as string;
      if (!userSubscriptions.has(uid)) {
        userSubscriptions.set(uid, sub);
      }
    });

    // Build result
    userIds.forEach((userId) => {
      const sub = userSubscriptions.get(userId);
      if (!sub) {
        result.set(userId, {
          hasSubscription: false,
          planName: null,
          expiresAt: null,
          isExpired: false,
        });
      } else {
        const expiresAt = sub.currentPeriodEnd as string | null;
        const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
        const planName = sub.planId ? plansMap.get(sub.planId as string) || null : null;
        result.set(userId, {
          hasSubscription: true,
          planName,
          expiresAt,
          isExpired,
        });
      }
    });

    return result;
  } catch (error) {
    console.error("Error fetching users subscription info:", error);
    // Return empty info for all users
    userIds.forEach((userId) => {
      result.set(userId, {
        hasSubscription: false,
        planName: null,
        expiresAt: null,
        isExpired: false,
      });
    });
    return result;
  }
}

/**
 * Post type for listing (matching actual database schema)
 */
export interface Post {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  type: string;
  title: string;
  smallDescription: string;
  description: string;
  media: string[];
  category: string;
  subCategory: string;
  // Location info - stored as [longitude, latitude] array
  location?: [number, number] | null;
  locationAddress?: string;
  locationPlaceId?: string;
  // Location state and city for filtering
  locationState?: string;
  locationCity?: string;
  // User's actual location when posting - stored as [longitude, latitude] array
  userLocation?: [number, number] | null;
  userLocationAddress?: string;
  // Event date (optional)
  eventDate?: string | null;
  // External link (optional)
  externalLink?: string;
  // Blacklist status (admin moderation)
  isBlacklisted?: boolean;
  /** Optional Appwrite attribute for qollaby-admin internal notes */
  adminNotes?: string;
  /** Denormalized from post_views (mobile app analytics) */
  views?: number;
  /** Denormalized from post_clicks */
  clicks?: number;
}

// Exchange Listing interface (separate table from posts)
export interface ExchangeListing {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  title: string;
  description: string;
  media: string[];
  category: string;
  subCategory: string;
  locationState: string;
  locationCity: string;
  locationId?: string;
  startingPrice?: number | null;
  maxPrice?: number | null;
  currentBid?: number | null;
  auctionEndDate?: string | null;
  status: string;
  transactionType?: string;
  // For compatibility with Post display
  type: "exchange";
  isBlacklisted?: boolean;
  adminNotes?: string;
  views?: number;
  clicks?: number;
}

export interface ExchangeListingListParams {
  page?: number;
  limit?: number;
  search?: string;
  state?: string;
  city?: string;
  category?: string;
  subcategory?: string;
}

export interface ExchangeListingListResult {
  listings: ExchangeListing[];
  total: number;
  page: number;
  totalPages: number;
}

// Report interface
export interface Report {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  postId: string;
  reporterId: string;
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
}

// Appeal interface for blacklisted posts
export interface Appeal {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  postId: string;
  userId: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export interface PostListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: "all" | "post" | "event" | "exchange";
  state?: string;
  city?: string;
  category?: string;
  subcategory?: string;
}

export interface PostListResult {
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Get paginated list of posts (from posts table - post/event types only)
 */
export async function getPosts(params: PostListParams = {}): Promise<PostListResult> {
  const { page = 1, limit = 20, search, type = "all", state, city, category, subcategory } = params;
  const offset = (page - 1) * limit;

  console.log("[getPosts] Called with params:", { page, limit, search, type, state, city, category, subcategory });

  try {
    const queries: string[] = [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ];

    // Count query (same filters but without pagination)
    const countQueries: string[] = [Query.limit(1)];

    // Filter by type (post, event, or all) - exchange is in separate table
    if (type === "post") {
      queries.push(Query.equal("type", "post"));
      countQueries.push(Query.equal("type", "post"));
    } else if (type === "event") {
      queries.push(Query.equal("type", "event"));
      countQueries.push(Query.equal("type", "event"));
    } else {
      // "all" - include both post and event types (exchange is separate)
      queries.push(Query.contains("type", ["post", "event"]));
      countQueries.push(Query.contains("type", ["post", "event"]));
    }

    // Filter by search
    if (search && search.trim()) {
      queries.push(Query.contains("title", search.trim()));
      countQueries.push(Query.contains("title", search.trim()));
    }

    // Filter by state (locationState in posts table)
    if (state && state.trim()) {
      console.log("[getPosts] Adding state filter: locationState =", state.trim());
      queries.push(Query.equal("locationState", state.trim()));
      countQueries.push(Query.equal("locationState", state.trim()));
    }

    // Filter by city (locationCity in posts table)
    if (city && city.trim()) {
      console.log("[getPosts] Adding city filter: locationCity =", city.trim());
      queries.push(Query.equal("locationCity", city.trim()));
      countQueries.push(Query.equal("locationCity", city.trim()));
    }

    // Filter by category
    if (category && category.trim()) {
      queries.push(Query.equal("category", category.trim()));
      countQueries.push(Query.equal("category", category.trim()));
    }

    // Filter by subcategory
    if (subcategory && subcategory.trim()) {
      queries.push(Query.equal("subCategory", subcategory.trim()));
      countQueries.push(Query.equal("subCategory", subcategory.trim()));
    }

    console.log("[getPosts] Final queries:", queries);

    const [postsRes, totalRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.POSTS,
        queries
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.POSTS,
        countQueries
      ),
    ]);

    console.log("[getPosts] Result: total =", totalRes.total, ", documents returned =", postsRes.documents.length);
    
    // Log first document to check field names
    if (postsRes.documents.length > 0) {
      const firstDoc = postsRes.documents[0];
      console.log("[getPosts] First document fields:", {
        id: firstDoc.$id,
        locationState: firstDoc.locationState,
        locationCity: firstDoc.locationCity,
        locationAddress: firstDoc.locationAddress,
        hasLocationState: 'locationState' in firstDoc,
        hasLocationCity: 'locationCity' in firstDoc,
      });
    } else {
      console.log("[getPosts] No documents found. Check if locationState/locationCity fields exist in posts table.");
    }

    return {
      posts: postsRes.documents as unknown as Post[],
      total: totalRes.total,
      page,
      totalPages: Math.ceil(totalRes.total / limit),
    };
  } catch (error) {
    console.error("[getPosts] Error fetching posts:", error);
    throw error;
  }
}

/**
 * Get paginated list of exchange listings (from exchange_listings table)
 */
export async function getExchangeListings(params: ExchangeListingListParams = {}): Promise<ExchangeListingListResult> {
  const { page = 1, limit = 20, search, state, city, category, subcategory } = params;
  const offset = (page - 1) * limit;

  try {
    const queries: string[] = [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ];

    // Count query (same filters but without pagination)
    const countQueries: string[] = [Query.limit(1)];

    // Filter by search
    if (search && search.trim()) {
      queries.push(Query.contains("title", search.trim()));
      countQueries.push(Query.contains("title", search.trim()));
    }

    // Filter by state (locationState in exchange_listings)
    if (state && state.trim()) {
      queries.push(Query.equal("locationState", state.trim()));
      countQueries.push(Query.equal("locationState", state.trim()));
    }

    // Filter by city (locationCity in exchange_listings)
    if (city && city.trim()) {
      queries.push(Query.equal("locationCity", city.trim()));
      countQueries.push(Query.equal("locationCity", city.trim()));
    }

    // Filter by category
    if (category && category.trim()) {
      queries.push(Query.equal("category", category.trim()));
      countQueries.push(Query.equal("category", category.trim()));
    }

    // Filter by subcategory (subCategory in exchange_listings)
    if (subcategory && subcategory.trim()) {
      queries.push(Query.equal("subCategory", subcategory.trim()));
      countQueries.push(Query.equal("subCategory", subcategory.trim()));
    }

    const [listingsRes, totalRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.EXCHANGE_LISTINGS,
        queries
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.EXCHANGE_LISTINGS,
        countQueries
      ),
    ]);

    // Add type: "exchange" for compatibility with Post display
    const listings = listingsRes.documents.map((doc) => ({
      ...doc,
      type: "exchange" as const,
    })) as unknown as ExchangeListing[];

    return {
      listings,
      total: totalRes.total,
      page,
      totalPages: Math.ceil(totalRes.total / limit),
    };
  } catch (error) {
    console.error("Error fetching exchange listings:", error);
    throw error;
  }
}

/**
 * Get single post by ID
 */
export async function getPostById(postId: string): Promise<Post | null> {
  try {
    const doc = await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.POSTS,
      postId
    );
    return doc as unknown as Post;
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
}

export async function getExchangeListingById(listingId: string): Promise<ExchangeListing | null> {
  try {
    const doc = await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.EXCHANGE_LISTINGS,
      listingId
    );
    return { ...doc, type: "exchange" as const } as unknown as ExchangeListing;
  } catch (error) {
    console.error("Error fetching exchange listing:", error);
    return null;
  }
}

export type UpdatePostInput = {
  title?: string;
  description?: string;
  smallDescription?: string;
};

export async function updatePostDocument(
  postId: string,
  patch: UpdatePostInput
): Promise<Post | null> {
  try {
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.POSTS,
      postId,
      patch
    );
    return doc as unknown as Post;
  } catch (error) {
    console.error("Error updating post:", error);
    return null;
  }
}

export type UpdateExchangeListingInput = {
  title?: string;
  description?: string;
};

export async function updateExchangeListingDocument(
  listingId: string,
  patch: UpdateExchangeListingInput
): Promise<ExchangeListing | null> {
  try {
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.EXCHANGE_LISTINGS,
      listingId,
      patch
    );
    return { ...doc, type: "exchange" as const } as unknown as ExchangeListing;
  } catch (error) {
    console.error("Error updating exchange listing:", error);
    return null;
  }
}

export async function deletePost(postId: string): Promise<boolean> {
  try {
    await databases.deleteDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.POSTS,
      postId
    );
    return true;
  } catch (error) {
    console.error("Error deleting post:", error);
    return false;
  }
}

export async function deleteExchangeListing(listingId: string): Promise<boolean> {
  try {
    await databases.deleteDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.EXCHANGE_LISTINGS,
      listingId
    );
    return true;
  } catch (error) {
    console.error("Error deleting exchange listing:", error);
    return false;
  }
}

/**
 * Get post statistics
 */
export async function getPostStats(): Promise<{
  totalPosts: number;
  recentPosts: number;
}> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalRes, recentRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.POSTS,
        [Query.contains("type", ["post", "event"]), Query.limit(1)]
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.POSTS,
        [
          Query.contains("type", ["post", "event"]),
          Query.greaterThan("$createdAt", sevenDaysAgo.toISOString()),
          Query.limit(1),
        ]
      ),
    ]);

    return {
      totalPosts: totalRes.total,
      recentPosts: recentRes.total,
    };
  } catch (error) {
    console.error("Error fetching post stats:", error);
    return { totalPosts: 0, recentPosts: 0 };
  }
}

const DISTRIBUTION_SCAN_BATCH = 200;
const DISTRIBUTION_SCAN_CAP = 3000;
const DISTRIBUTION_MAX_SLICES = 8;

export type DistributionSlice = { key: string; label: string; count: number };

export type FieldDistributionResult = {
  slices: DistributionSlice[];
  /** Total documents matching filter in Appwrite */
  totalInDatabase: number;
  /** Documents read for aggregation (capped) */
  scannedCount: number;
  /** Sum of `views` over the same capped scan (e.g. sponsor ads pie). */
  sampleViewsSum?: number;
  /** Sum of `clicks` over the same capped scan. */
  sampleClicksSum?: number;
};

function collapseSlices(
  slices: DistributionSlice[],
  maxVisible: number,
  otherLabel: string
): DistributionSlice[] {
  if (slices.length <= maxVisible) return slices;
  const top = slices.slice(0, maxVisible - 1);
  const rest = slices.slice(maxVisible - 1);
  const otherCount = rest.reduce((s, x) => s + x.count, 0);
  return [...top, { key: "__other__", label: otherLabel, count: otherCount }];
}

/**
 * Category mix among the newest documents (capped scan) for admin list context.
 */
export async function getPostsCategoryDistribution(
  postType: "post" | "event"
): Promise<FieldDistributionResult> {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const counts = new Map<string, number>();
  let offset = 0;
  let totalInDb = 0;

  try {
    while (offset < DISTRIBUTION_SCAN_CAP) {
      const res = await databases.listDocuments(dbId, Collections.POSTS, [
        Query.equal("type", postType),
        Query.orderDesc("$createdAt"),
        Query.limit(DISTRIBUTION_SCAN_BATCH),
        Query.offset(offset),
      ]);
      if (offset === 0) totalInDb = res.total;
      if (res.documents.length === 0) break;
      for (const doc of res.documents) {
        const raw = String((doc as { category?: string }).category ?? "").trim();
        const key = raw || "—";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      offset += res.documents.length;
      if (res.documents.length < DISTRIBUTION_SCAN_BATCH) break;
    }

    const slices = [...counts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count);

    return {
      slices: collapseSlices(slices, DISTRIBUTION_MAX_SLICES, "Other categories"),
      totalInDatabase: totalInDb,
      scannedCount: offset,
    };
  } catch (error) {
    console.error("Error aggregating post categories:", error);
    return { slices: [], totalInDatabase: 0, scannedCount: 0 };
  }
}

/**
 * Status (or category) mix among the newest exchange listings (capped scan).
 */
export async function getExchangeListingsFieldDistribution(
  field: "status" | "category" = "status"
): Promise<FieldDistributionResult> {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const counts = new Map<string, number>();
  let offset = 0;
  let totalInDb = 0;

  try {
    while (offset < DISTRIBUTION_SCAN_CAP) {
      const res = await databases.listDocuments(
        dbId,
        Collections.EXCHANGE_LISTINGS,
        [
          Query.orderDesc("$createdAt"),
          Query.limit(DISTRIBUTION_SCAN_BATCH),
          Query.offset(offset),
        ]
      );
      if (offset === 0) totalInDb = res.total;
      if (res.documents.length === 0) break;
      for (const doc of res.documents) {
        const d = doc as { status?: string; category?: string };
        const raw =
          field === "category"
            ? String(d.category ?? "").trim()
            : String(d.status ?? "").trim();
        const key = raw || "—";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      offset += res.documents.length;
      if (res.documents.length < DISTRIBUTION_SCAN_BATCH) break;
    }

    const slices = [...counts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count);

    const otherLabel = field === "category" ? "Other categories" : "Other statuses";
    return {
      slices: collapseSlices(slices, DISTRIBUTION_MAX_SLICES, otherLabel),
      totalInDatabase: totalInDb,
      scannedCount: offset,
    };
  } catch (error) {
    console.error("Error aggregating exchange listings:", error);
    return { slices: [], totalInDatabase: 0, scannedCount: 0 };
  }
}

/** Full-database counts for exchange listing status buckets (admin dashboard row 3). */
export type ExchangeAdminStatusCounts = {
  active: number;
  expired: number;
  sold: number;
};

/** Posts / exchange admin list: pie + DB totals + view/click sums over the same capped scan as the pie. */
export type ContentAdminDashboardMetrics = FieldDistributionResult & {
  activeInDatabase: number;
  recent7Days: number;
  sampleViewsSum: number;
  sampleClicksSum: number;
  /** Set only for `getExchangeAdminDashboardMetrics`. */
  exchangeStatusCounts?: ExchangeAdminStatusCounts;
};

export async function getPostsAdminDashboardMetrics(
  postType: "post" | "event"
): Promise<ContentAdminDashboardMetrics> {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  try {
    const [totalRes, activeRes, recentRes] = await Promise.all([
      databases.listDocuments(dbId, Collections.POSTS, [
        Query.equal("type", postType),
        Query.limit(1),
      ]),
      databases.listDocuments(dbId, Collections.POSTS, [
        Query.equal("type", postType),
        Query.or([Query.isNull("isBlacklisted"), Query.equal("isBlacklisted", false)]),
        Query.limit(1),
      ]),
      databases.listDocuments(dbId, Collections.POSTS, [
        Query.equal("type", postType),
        Query.greaterThan("$createdAt", since),
        Query.limit(1),
      ]),
    ]);

    const counts = new Map<string, number>();
    let offset = 0;
    let sampleViews = 0;
    let sampleClicks = 0;

    while (offset < DISTRIBUTION_SCAN_CAP) {
      const res = await databases.listDocuments(dbId, Collections.POSTS, [
        Query.equal("type", postType),
        Query.orderDesc("$createdAt"),
        Query.limit(DISTRIBUTION_SCAN_BATCH),
        Query.offset(offset),
      ]);
      if (res.documents.length === 0) break;
      for (const doc of res.documents) {
        const d = doc as { category?: string; views?: number; clicks?: number };
        const raw = String(d.category ?? "").trim();
        const key = raw || "—";
        counts.set(key, (counts.get(key) ?? 0) + 1);
        sampleViews += Number(d.views) || 0;
        sampleClicks += Number(d.clicks) || 0;
      }
      offset += res.documents.length;
      if (res.documents.length < DISTRIBUTION_SCAN_BATCH) break;
    }

    const slices = [...counts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count);

    return {
      slices: collapseSlices(slices, DISTRIBUTION_MAX_SLICES, "Other categories"),
      totalInDatabase: totalRes.total,
      scannedCount: offset,
      activeInDatabase: activeRes.total,
      recent7Days: recentRes.total,
      sampleViewsSum: sampleViews,
      sampleClicksSum: sampleClicks,
    };
  } catch (error) {
    console.error("Error loading posts admin dashboard metrics:", error);
    return {
      slices: [],
      totalInDatabase: 0,
      scannedCount: 0,
      activeInDatabase: 0,
      recent7Days: 0,
      sampleViewsSum: 0,
      sampleClicksSum: 0,
    };
  }
}

export async function getExchangeAdminDashboardMetrics(): Promise<ContentAdminDashboardMetrics> {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  try {
    const [totalRes, activeRes, recentRes, soldRes, expiredRes] = await Promise.all([
      databases.listDocuments(dbId, Collections.EXCHANGE_LISTINGS, [Query.limit(1)]),
      databases.listDocuments(dbId, Collections.EXCHANGE_LISTINGS, [
        Query.equal("status", "active"),
        Query.limit(1),
      ]),
      databases.listDocuments(dbId, Collections.EXCHANGE_LISTINGS, [
        Query.greaterThan("$createdAt", since),
        Query.limit(1),
      ]),
      databases.listDocuments(dbId, Collections.EXCHANGE_LISTINGS, [
        Query.equal("status", "sold"),
        Query.limit(1),
      ]),
      databases.listDocuments(dbId, Collections.EXCHANGE_LISTINGS, [
        Query.or([Query.equal("status", "expired"), Query.equal("status", "auction_expired")]),
        Query.limit(1),
      ]),
    ]);

    const counts = new Map<string, number>();
    let offset = 0;
    let sampleViews = 0;
    let sampleClicks = 0;

    while (offset < DISTRIBUTION_SCAN_CAP) {
      const res = await databases.listDocuments(dbId, Collections.EXCHANGE_LISTINGS, [
        Query.orderDesc("$createdAt"),
        Query.limit(DISTRIBUTION_SCAN_BATCH),
        Query.offset(offset),
      ]);
      if (res.documents.length === 0) break;
      for (const doc of res.documents) {
        const d = doc as { status?: string; views?: number; clicks?: number };
        const raw = String(d.status ?? "").trim();
        const key = raw || "—";
        counts.set(key, (counts.get(key) ?? 0) + 1);
        sampleViews += Number(d.views) || 0;
        sampleClicks += Number(d.clicks) || 0;
      }
      offset += res.documents.length;
      if (res.documents.length < DISTRIBUTION_SCAN_BATCH) break;
    }

    const slices = [...counts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count);

    return {
      slices: collapseSlices(slices, DISTRIBUTION_MAX_SLICES, "Other statuses"),
      totalInDatabase: totalRes.total,
      scannedCount: offset,
      activeInDatabase: activeRes.total,
      recent7Days: recentRes.total,
      sampleViewsSum: sampleViews,
      sampleClicksSum: sampleClicks,
      exchangeStatusCounts: {
        active: activeRes.total,
        sold: soldRes.total,
        expired: expiredRes.total,
      },
    };
  } catch (error) {
    console.error("Error loading exchange admin dashboard metrics:", error);
    return {
      slices: [],
      totalInDatabase: 0,
      scannedCount: 0,
      activeInDatabase: 0,
      recent7Days: 0,
      sampleViewsSum: 0,
      sampleClicksSum: 0,
      exchangeStatusCounts: { active: 0, sold: 0, expired: 0 },
    };
  }
}

// ==================== REPORT MANAGEMENT ====================
// Per-post like/stamp/report counts: POST /api/admin/post-stats + src/lib/post-stats-queries.ts (APPWRITE_API_KEY).

/**
 * Get all reports (paginated)
 */
export interface ReportListParams {
  page?: number;
  limit?: number;
  status?: "all" | "pending" | "reviewed" | "dismissed";
}

export interface ReportListResult {
  reports: Report[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getReports(params: ReportListParams = {}): Promise<ReportListResult> {
  const { page = 1, limit = 20, status = "all" } = params;
  const offset = (page - 1) * limit;

  try {
    const queries: string[] = [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ];

    const countQueries: string[] = [Query.limit(1)];

    if (status !== "all") {
      queries.push(Query.equal("status", status));
      countQueries.push(Query.equal("status", status));
    }

    const [reportsRes, totalRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.REPORTS,
        queries
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.REPORTS,
        countQueries
      ),
    ]);

    return {
      reports: reportsRes.documents as unknown as Report[],
      total: totalRes.total,
      page,
      totalPages: Math.ceil(totalRes.total / limit),
    };
  } catch (error) {
    console.error("Error fetching reports:", error);
    return { reports: [], total: 0, page: 1, totalPages: 0 };
  }
}

/**
 * Update report status
 */
export async function updateReportStatus(
  reportId: string,
  status: "pending" | "reviewed" | "dismissed"
): Promise<Report | null> {
  try {
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.REPORTS,
      reportId,
      { status }
    );
    return doc as unknown as Report;
  } catch (error) {
    console.error("Error updating report status:", error);
    return null;
  }
}

// ==================== POST BLACKLIST MANAGEMENT ====================

/**
 * Blacklist a post (hide from public feed)
 */
export async function blacklistPost(postId: string): Promise<Post | null> {
  try {
    console.log(`[Blacklist] Blacklisting post: ${postId}`);
    
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.POSTS,
      postId,
      { isBlacklisted: true }
    );
    
    console.log(`[Blacklist] Post blacklisted successfully`);
    
    return doc as unknown as Post;
  } catch (error) {
    console.error("[Blacklist] Error blacklisting post:", error);
    // If 'isBlacklisted' attribute doesn't exist, this error will occur
    // User needs to add 'isBlacklisted' (Boolean) attribute to Posts collection
    return null;
  }
}

/**
 * Remove post from blacklist
 */
export async function unblacklistPost(postId: string): Promise<Post | null> {
  try {
    console.log(`[Unblacklist] Unblacklisting post: ${postId}`);
    
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.POSTS,
      postId,
      { isBlacklisted: false }
    );
    
    console.log(`[Unblacklist] Post unblacklisted successfully`);
    
    return doc as unknown as Post;
  } catch (error) {
    console.error("[Unblacklist] Error removing post from blacklist:", error);
    return null;
  }
}

/**
 * Get blacklisted posts count
 */
export async function getBlacklistedPostsCount(): Promise<number> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.POSTS,
      [Query.equal("isBlacklisted", true), Query.limit(1)]
    );
    return res.total;
  } catch (error) {
    console.error("Error fetching blacklisted posts count:", error);
    return 0;
  }
}

// ==================== APPEAL MANAGEMENT ====================

/**
 * Get all appeals (paginated)
 */
export interface AppealListParams {
  page?: number;
  limit?: number;
  status?: "all" | "pending" | "approved" | "rejected";
}

export interface AppealListResult {
  appeals: Appeal[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getAppeals(params: AppealListParams = {}): Promise<AppealListResult> {
  const { page = 1, limit = 20, status = "all" } = params;
  const offset = (page - 1) * limit;

  try {
    const queries: string[] = [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ];

    const countQueries: string[] = [Query.limit(1)];

    if (status !== "all") {
      queries.push(Query.equal("status", status));
      countQueries.push(Query.equal("status", status));
    }

    const [appealsRes, totalRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.APPEALS,
        queries
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.APPEALS,
        countQueries
      ),
    ]);

    return {
      appeals: appealsRes.documents as unknown as Appeal[],
      total: totalRes.total,
      page,
      totalPages: Math.ceil(totalRes.total / limit),
    };
  } catch (error) {
    console.error("Error fetching appeals:", error);
    return { appeals: [], total: 0, page: 1, totalPages: 0 };
  }
}

/**
 * Get appeal by ID
 */
export async function getAppealById(appealId: string): Promise<Appeal | null> {
  try {
    const doc = await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.APPEALS,
      appealId
    );
    return doc as unknown as Appeal;
  } catch (error) {
    console.error("Error fetching appeal:", error);
    return null;
  }
}

/**
 * Approve appeal (unblacklist post)
 */
export async function approveAppeal(appealId: string): Promise<boolean> {
  try {
    // Get the appeal to find the postId
    const appeal = await getAppealById(appealId);
    if (!appeal) return false;

    // Update appeal status
    await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.APPEALS,
      appealId,
      { status: "approved" }
    );

    // Unblacklist the post
    await unblacklistPost(appeal.postId);

    return true;
  } catch (error) {
    console.error("Error approving appeal:", error);
    return false;
  }
}

/**
 * Reject appeal
 */
export async function rejectAppeal(appealId: string): Promise<boolean> {
  try {
    await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.APPEALS,
      appealId,
      { status: "rejected" }
    );
    return true;
  } catch (error) {
    console.error("Error rejecting appeal:", error);
    return false;
  }
}

/**
 * Get pending appeals count
 */
export async function getPendingAppealsCount(): Promise<number> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.APPEALS,
      [Query.equal("status", "pending"), Query.limit(1)]
    );
    return res.total;
  } catch (error) {
    console.error("Error fetching pending appeals count:", error);
    return 0;
  }
}

/**
 * Get pending reports count
 */
export async function getPendingReportsCount(): Promise<number> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.REPORTS,
      [Query.equal("status", "pending"), Query.limit(1)]
    );
    return res.total;
  } catch (error) {
    console.error("Error fetching pending reports count:", error);
    return 0;
  }
}

// ==================== SPONSOR ADS MANAGEMENT ====================

export type SponsorAdStatus = "active" | "pending" | "expired" | "rejected";

export interface SponsorAd {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  title: string;
  description?: string;
  media: string[];
  image?: string; // Legacy field
  state: string;
  city: string;
  category: string;
  subcategory?: string;
  status: SponsorAdStatus;
  views: number;
  clicks: number;
  expiresAt: string;
  // Blacklist status (admin moderation)
  isBlacklisted?: boolean;
  slot?: number;
  // Admin created ad flag
  isAdminCreated?: boolean;
  // Contact info
  phoneNumber?: string;
  website?: string;
  tag?: "home" | "event" | "exchange";
}

export type AdTagType = "home" | "event" | "exchange";

export interface SponsorAdListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | SponsorAdStatus;
  state?: string;
  city?: string;
  category?: string;
  subcategory?: string;
  isAdminCreated?: boolean; // Filter by admin-created ads (true = admin, false = user)
}

export interface SponsorAdListResult {
  ads: SponsorAd[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Get all admin-created ads organized by slot
 * Uses pagination to fetch all ads (Appwrite default limit can truncate results)
 */
export async function getAdminAdsBySlot(tag?: AdTagType): Promise<Map<number, SponsorAd[]>> {
  try {
    const adsBySlot = new Map<number, SponsorAd[]>();
    const pageSize = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const queries = [
        Query.equal("isAdminCreated", true),
        Query.limit(pageSize),
        Query.offset(offset),
      ];
      if (tag) queries.push(Query.equal("tag", tag));

      const adsRes = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        queries
      );

      for (const doc of adsRes.documents) {
        const ad = doc as unknown as SponsorAd;
        const storedSlot = ad.slot;
        if (storedSlot !== undefined && storedSlot !== null) {
          const existing = adsBySlot.get(storedSlot) || [];
          existing.push(ad);
          adsBySlot.set(storedSlot, existing);
        }
      }

      if (adsRes.documents.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }

    return adsBySlot;
  } catch (error) {
    console.error("Error fetching admin ads by slot:", error);
    return new Map();
  }
}

/**
 * Get paginated list of sponsor ads
 */
export async function getSponsorAds(params: SponsorAdListParams = {}): Promise<SponsorAdListResult> {
  const { page = 1, limit = 20, search, status = "all", state, city, category, subcategory, isAdminCreated } = params;
  const offset = (page - 1) * limit;
  const t0 = performance.now();

  try {
    const orderQuery =
      isAdminCreated === false
        ? Query.orderAsc("slot")
        : Query.orderDesc("$createdAt");

    const queries: string[] = [
      orderQuery,
      Query.limit(limit),
      Query.offset(offset),
    ];

    const countQueries: string[] = [Query.limit(1)];

    if (status !== "all") {
      queries.push(Query.equal("status", status));
      countQueries.push(Query.equal("status", status));
    }

    if (search && search.trim()) {
      queries.push(Query.contains("title", search.trim()));
      countQueries.push(Query.contains("title", search.trim()));
    }

    if (isAdminCreated === true) {
      queries.push(Query.equal("isAdminCreated", true));
      countQueries.push(Query.equal("isAdminCreated", true));
    } else if (isAdminCreated === false) {
      queries.push(Query.or([
        Query.isNull("isAdminCreated"),
        Query.equal("isAdminCreated", false)
      ]));
      countQueries.push(Query.or([
        Query.isNull("isAdminCreated"),
        Query.equal("isAdminCreated", false)
      ]));
    }

    if (state && state.trim()) {
      queries.push(Query.equal("state", state.trim()));
      countQueries.push(Query.equal("state", state.trim()));
    }

    if (city && city.trim()) {
      queries.push(Query.equal("city", city.trim()));
      countQueries.push(Query.equal("city", city.trim()));
    }

    if (category && category.trim()) {
      queries.push(Query.equal("category", category.trim()));
      countQueries.push(Query.equal("category", category.trim()));
    }

    if (subcategory && subcategory.trim()) {
      queries.push(Query.equal("subcategory", subcategory.trim()));
      countQueries.push(Query.equal("subcategory", subcategory.trim()));
    }

    const [adsRes, totalRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        queries
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        countQueries
      ),
    ]);

    console.log(`[perf] getSponsorAds: ${(performance.now() - t0).toFixed(0)}ms (${adsRes.documents.length} docs, total ${totalRes.total})`);

    return {
      ads: adsRes.documents as unknown as SponsorAd[],
      total: totalRes.total,
      page,
      totalPages: Math.ceil(totalRes.total / limit),
    };
  } catch (error) {
    console.error("Error fetching sponsor ads:", error);
    return { ads: [], total: 0, page: 1, totalPages: 0 };
  }
}

export type SponsorAdsDistributionParams = {
  isAdminCreated: boolean;
  /** Admin slot ads only: filter by placement tag */
  tag?: AdTagType;
  field: "category" | "status";
};

/**
 * Newest sponsor ads (capped scan): totals for pie (views vs clicks) and list context.
 * `field` is kept for call-site compatibility; aggregation uses views/clicks only.
 */
export async function getSponsorAdsFieldDistribution(
  params: SponsorAdsDistributionParams
): Promise<FieldDistributionResult> {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const { isAdminCreated, tag } = params;
  let offset = 0;
  let totalInDb = 0;
  let sampleViews = 0;
  let sampleClicks = 0;

  const baseQueries: string[] = [];
  if (isAdminCreated) {
    baseQueries.push(Query.equal("isAdminCreated", true));
    if (tag) {
      baseQueries.push(Query.equal("tag", tag));
    }
  } else {
    baseQueries.push(
      Query.or([Query.isNull("isAdminCreated"), Query.equal("isAdminCreated", false)])
    );
  }

  try {
    while (offset < DISTRIBUTION_SCAN_CAP) {
      const res = await databases.listDocuments(dbId, Collections.SPONSOR_ADS, [
        ...baseQueries,
        Query.orderDesc("$createdAt"),
        Query.limit(DISTRIBUTION_SCAN_BATCH),
        Query.offset(offset),
      ]);
      if (offset === 0) totalInDb = res.total;
      if (res.documents.length === 0) break;
      for (const doc of res.documents) {
        const ad = doc as unknown as SponsorAd;
        sampleViews += Number(ad.views) || 0;
        sampleClicks += Number(ad.clicks) || 0;
      }
      offset += res.documents.length;
      if (res.documents.length < DISTRIBUTION_SCAN_BATCH) break;
    }

    return {
      slices: [],
      totalInDatabase: totalInDb,
      scannedCount: offset,
      sampleViewsSum: sampleViews,
      sampleClicksSum: sampleClicks,
    };
  } catch (error) {
    console.error("Error aggregating sponsor ads distribution:", error);
    return {
      slices: [],
      totalInDatabase: 0,
      scannedCount: 0,
      sampleViewsSum: 0,
      sampleClicksSum: 0,
    };
  }
}

/**
 * Get sponsor ad by ID
 */
export async function getSponsorAdById(adId: string): Promise<SponsorAd | null> {
  try {
    const doc = await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      adId
    );
    return doc as unknown as SponsorAd;
  } catch (error) {
    console.error("Error fetching sponsor ad:", error);
    return null;
  }
}

/**
 * Get sponsor ads stats
 * @param isAdminCreated - undefined: all ads, true: admin ads only, false: user ads only
 */
export async function getSponsorAdStats(isAdminCreated?: boolean, tag?: AdTagType): Promise<{
  totalAds: number;
  activeAds: number;
  pendingAds: number;
}> {
  const t0 = performance.now();
  try {
    const baseQueries: string[] = [];
    if (isAdminCreated === true) {
      baseQueries.push(Query.equal("isAdminCreated", true));
    } else if (isAdminCreated === false) {
      baseQueries.push(Query.or([
        Query.isNull("isAdminCreated"),
        Query.equal("isAdminCreated", false)
      ]));
    }
    if (tag) baseQueries.push(Query.equal("tag", tag));

    const [totalRes, activeRes, pendingRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        [...baseQueries, Query.limit(1)]
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        [...baseQueries, Query.equal("status", "active"), Query.limit(1)]
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        [...baseQueries, Query.equal("status", "pending"), Query.limit(1)]
      ),
    ]);

    console.log(`[perf] getSponsorAdStats: ${(performance.now() - t0).toFixed(0)}ms`);

    return {
      totalAds: totalRes.total,
      activeAds: activeRes.total,
      pendingAds: pendingRes.total,
    };
  } catch (error) {
    console.error("Error fetching sponsor ad stats:", error);
    return { totalAds: 0, activeAds: 0, pendingAds: 0 };
  }
}

/**
 * Get aggregated ad metrics (total views, clicks, CTR)
 * @param isAdminCreated - undefined: all ads, true: admin ads only, false: user ads only
 */
export async function getAdMetrics(isAdminCreated?: boolean): Promise<{
  totalViews: number;
  totalClicks: number;
  ctr: number;
}> {
  const t0 = performance.now();
  try {
    const baseQueries: string[] = [];
    if (isAdminCreated === true) {
      baseQueries.push(Query.equal("isAdminCreated", true));
    } else if (isAdminCreated === false) {
      baseQueries.push(Query.or([
        Query.isNull("isAdminCreated"),
        Query.equal("isAdminCreated", false)
      ]));
    }

    let totalViews = 0;
    let totalClicks = 0;
    const pageSize = 500;
    let offset = 0;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      const res = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        [...baseQueries, Query.limit(pageSize), Query.offset(offset)]
      );

      for (const doc of res.documents) {
        const ad = doc as unknown as SponsorAd;
        totalViews += ad.views || 0;
        totalClicks += ad.clicks || 0;
      }

      pages++;
      offset += pageSize;
      hasMore = offset < res.total;
    }

    console.log(`[perf] getAdMetrics: ${(performance.now() - t0).toFixed(0)}ms (${pages} pages, ${offset > pageSize ? offset - pageSize : 0}+ docs scanned)`);

    const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
    return { totalViews, totalClicks, ctr };
  } catch (error) {
    console.error("Error fetching ad metrics:", error);
    return { totalViews: 0, totalClicks: 0, ctr: 0 };
  }
}

/**
 * Conversion rate item for a dimension group
 */
export interface ConversionRateItem {
  name: string;
  totalViews: number;
  totalClicks: number;
  adCount: number;
  conversionRate: number;
}

/**
 * Conversion rate data by dimension
 */
export interface ConversionRateData {
  /** All sponsor ads (admin-created + user): views/clicks/ad count; full collection scan */
  overall: {
    totalViews: number;
    totalClicks: number;
    totalAds: number;
  };
  byCategory: ConversionRateItem[];
  bySubcategory: ConversionRateItem[];
  byState: ConversionRateItem[];
  byCity: ConversionRateItem[];
}

/**
 * Get conversion rate data grouped by category, subcategory, state, and city.
 * Scans the full `sponsor_ads` collection (admin + user ads), same universe as getAdMetrics(undefined).
 */
export async function getConversionRateData(): Promise<ConversionRateData> {
  const empty: ConversionRateData = {
    overall: { totalViews: 0, totalClicks: 0, totalAds: 0 },
    byCategory: [],
    bySubcategory: [],
    byState: [],
    byCity: [],
  };

  try {
    const categoryMap = new Map<string, { views: number; clicks: number; count: number }>();
    const subcategoryMap = new Map<string, { views: number; clicks: number; count: number }>();
    const stateMap = new Map<string, { views: number; clicks: number; count: number }>();
    const cityMap = new Map<string, { views: number; clicks: number; count: number }>();

    let overallViews = 0;
    let overallClicks = 0;
    let overallAds = 0;

    const pageSize = 500;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        [Query.limit(pageSize), Query.offset(offset)]
      );

      for (const doc of res.documents) {
        const ad = doc as unknown as SponsorAd;
        const views = ad.views || 0;
        const clicks = ad.clicks || 0;

        overallViews += views;
        overallClicks += clicks;
        overallAds += 1;

        if (ad.category) {
          const existing = categoryMap.get(ad.category) || { views: 0, clicks: 0, count: 0 };
          categoryMap.set(ad.category, {
            views: existing.views + views,
            clicks: existing.clicks + clicks,
            count: existing.count + 1,
          });
        }

        if (ad.subcategory) {
          const existing = subcategoryMap.get(ad.subcategory) || { views: 0, clicks: 0, count: 0 };
          subcategoryMap.set(ad.subcategory, {
            views: existing.views + views,
            clicks: existing.clicks + clicks,
            count: existing.count + 1,
          });
        }

        if (ad.state) {
          const existing = stateMap.get(ad.state) || { views: 0, clicks: 0, count: 0 };
          stateMap.set(ad.state, {
            views: existing.views + views,
            clicks: existing.clicks + clicks,
            count: existing.count + 1,
          });
        }

        if (ad.city) {
          const existing = cityMap.get(ad.city) || { views: 0, clicks: 0, count: 0 };
          cityMap.set(ad.city, {
            views: existing.views + views,
            clicks: existing.clicks + clicks,
            count: existing.count + 1,
          });
        }
      }

      offset += pageSize;
      hasMore = offset < res.total;
    }

    const mapToArray = (map: Map<string, { views: number; clicks: number; count: number }>): ConversionRateItem[] => {
      return Array.from(map.entries())
        .map(([name, data]) => ({
          name,
          totalViews: data.views,
          totalClicks: data.clicks,
          adCount: data.count,
          conversionRate: data.views > 0 ? (data.clicks / data.views) * 100 : 0,
        }))
        .sort((a, b) => b.conversionRate - a.conversionRate);
    };

    return {
      overall: {
        totalViews: overallViews,
        totalClicks: overallClicks,
        totalAds: overallAds,
      },
      byCategory: mapToArray(categoryMap),
      bySubcategory: mapToArray(subcategoryMap),
      byState: mapToArray(stateMap),
      byCity: mapToArray(cityMap),
    };
  } catch (error) {
    console.error("Error fetching conversion rate data:", error);
    return empty;
  }
}

/**
 * Blacklist a sponsor ad
 */
export async function blacklistSponsorAd(adId: string): Promise<SponsorAd | null> {
  try {
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      adId,
      { isBlacklisted: true }
    );
    
    return doc as unknown as SponsorAd;
  } catch (error) {
    console.error("Error blacklisting sponsor ad:", error);
    return null;
  }
}

/**
 * Remove sponsor ad from blacklist
 */
export async function unblacklistSponsorAd(adId: string): Promise<SponsorAd | null> {
  try {
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      adId,
      { isBlacklisted: false }
    );
    
    return doc as unknown as SponsorAd;
  } catch (error) {
    console.error("Error removing sponsor ad from blacklist:", error);
    return null;
  }
}

/**
 * Update sponsor ad status
 */
export async function updateSponsorAdStatus(
  adId: string,
  status: SponsorAdStatus
): Promise<SponsorAd | null> {
  try {
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      adId,
      { status }
    );
    return doc as unknown as SponsorAd;
  } catch (error) {
    console.error("Error updating sponsor ad status:", error);
    return null;
  }
}

/**
 * Update ad slot for admin-created ads
 * Note: slot is stored as (displaySlot - 1) in database
 *
 * Slot capacity is enforced per tag. We refuse the move if the destination slot
 * is already at capacity within the ad's current tag. Reassigning to the slot
 * that already holds this ad is a no-op and is allowed.
 */
export async function updateSponsorAdSlot(
  adId: string,
  slot: AdSlot
): Promise<SponsorAd | null> {
  try {
    const current = (await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      adId
    )) as unknown as SponsorAd;
    const storedSlot = slot - 1;
    if (current.slot !== storedSlot) {
      const maxUsage = getSlotMaxUsage(slot);
      const tagValue = current.tag || "";
      const existing = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        [
          Query.equal("isAdminCreated", true),
          Query.equal("slot", storedSlot),
          Query.equal("tag", tagValue),
          Query.notEqual("$id", adId),
          Query.limit(maxUsage + 1),
        ]
      );
      if (existing.total >= maxUsage) {
        throw new Error(`Slot ${slot} is already full (max ${maxUsage})`);
      }
    }
    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      adId,
      { slot: storedSlot }
    );
    return doc as unknown as SponsorAd;
  } catch (error) {
    console.error("Error updating sponsor ad slot:", error);
    throw error;
  }
}

/**
 * Update sponsor ad (admin-created ads only)
 */
export interface UpdateSponsorAdInput {
  title?: string;
  description?: string;
  media?: string[];
  image?: string;
  state?: string;
  city?: string;
  category?: string;
  subcategory?: string;
  slot?: AdSlot;
  phoneNumber?: string;
  website?: string;
  tag?: AdTagType;
}

export async function updateSponsorAd(
  adId: string,
  input: UpdateSponsorAdInput
): Promise<SponsorAd | null> {
  try {
    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.media !== undefined) updateData.media = input.media;
    if (input.image !== undefined) updateData.image = input.image;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.subcategory !== undefined) updateData.subcategory = input.subcategory;
    if (input.slot !== undefined) updateData.slot = input.slot - 1; // Store as slot - 1
    if (input.phoneNumber !== undefined) updateData.phoneNumber = input.phoneNumber;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.tag !== undefined) updateData.tag = input.tag;

    // Tag-scoped slot capacity guard. Only run when slot or tag is actually changing.
    if (input.slot !== undefined || input.tag !== undefined) {
      const current = (await databases.getDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SPONSOR_ADS,
        adId
      )) as unknown as SponsorAd;
      const nextStoredSlot = input.slot !== undefined ? input.slot - 1 : current.slot;
      const nextTag = input.tag !== undefined ? input.tag : current.tag || "";
      const slotChanged = nextStoredSlot !== current.slot;
      const tagChanged = (current.tag || "") !== nextTag;
      if (slotChanged || tagChanged) {
        const displaySlot = (nextStoredSlot ?? 0) + 1;
        const maxUsage = getSlotMaxUsage(displaySlot);
        const existing = await databases.listDocuments(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          Collections.SPONSOR_ADS,
          [
            Query.equal("isAdminCreated", true),
            Query.equal("slot", nextStoredSlot ?? -1),
            Query.equal("tag", nextTag),
            Query.notEqual("$id", adId),
            Query.limit(maxUsage + 1),
          ]
        );
        if (existing.total >= maxUsage) {
          throw new Error(`Slot ${displaySlot} is already full (max ${maxUsage})`);
        }
      }
    }

    const doc = await databases.updateDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      adId,
      updateData
    );
    return doc as unknown as SponsorAd;
  } catch (error) {
    console.error("Error updating sponsor ad:", error);
    throw error;
  }
}

/**
 * Delete sponsor ad (admin-created ads only)
 */
export async function deleteSponsorAd(adId: string): Promise<boolean> {
  try {
    await databases.deleteDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      adId
    );
    return true;
  } catch (error) {
    console.error("Error deleting sponsor ad:", error);
    return false;
  }
}

/**
 * Get ad likes count
 */
export async function getAdLikeCount(adId: string): Promise<number> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.AD_LIKES,
      [Query.equal("adId", adId), Query.limit(1)]
    );
    return res.total;
  } catch (error) {
    console.error("Error fetching ad like count:", error);
    return 0;
  }
}

/**
 * Batch get likes counts for multiple ads
 */
export async function getAdsLikeCounts(adIds: string[]): Promise<Map<string, number>> {
  const t0 = performance.now();
  const result = new Map<string, number>();
  if (adIds.length === 0) return result;

  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.AD_LIKES,
      [Query.equal("adId", adIds), Query.limit(5000)]
    );

    adIds.forEach((id) => result.set(id, 0));
    res.documents.forEach((doc) => {
      const adId = doc.adId as string;
      result.set(adId, (result.get(adId) || 0) + 1);
    });

    console.log(`[perf] getAdsLikeCounts: ${(performance.now() - t0).toFixed(0)}ms (${res.documents.length} likes for ${adIds.length} ads)`);

    return result;
  } catch (error) {
    console.error("Error fetching ads like counts:", error);
    adIds.forEach((id) => result.set(id, 0));
    return result;
  }
}

/**
 * Batch report counts where `reports.postId` matches sponsor ad `$id`
 * (same field name as post reports; app uses this id when reporting an ad).
 */
export async function getAdsReportCounts(adIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (adIds.length === 0) return result;

  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.REPORTS,
      [Query.equal("postId", adIds), Query.limit(5000)]
    );

    adIds.forEach((id) => result.set(id, 0));
    res.documents.forEach((doc) => {
      const pid = doc.postId as string;
      result.set(pid, (result.get(pid) || 0) + 1);
    });

    return result;
  } catch (error) {
    console.error("Error fetching ads report counts:", error);
    adIds.forEach((id) => result.set(id, 0));
    return result;
  }
}

/** Stamp counts for arbitrary ids (post id or ad id if stamps ever use the same field). */
export async function getPostStampsByPostIds(ids: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (ids.length === 0) return result;

  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.POST_STAMPS,
      [Query.equal("postId", ids), Query.limit(5000)]
    );

    ids.forEach((id) => result.set(id, 0));
    res.documents.forEach((doc) => {
      const pid = doc.postId as string;
      result.set(pid, (result.get(pid) || 0) + 1);
    });

    return result;
  } catch (error) {
    console.error("Error fetching stamp counts:", error);
    ids.forEach((id) => result.set(id, 0));
    return result;
  }
}

/**
 * Available ad slots for admin to choose from
 */
export const AD_SLOTS = [1, 5, 8, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110] as const;
export type AdSlot = typeof AD_SLOTS[number];

/**
 * Slots that can be used up to 3 times
 */
export const MULTI_USE_SLOTS = [5, 8, 15, 25, 35, 45, 55, 65] as const;

/**
 * Slots that can only be used once
 */
export const SINGLE_USE_SLOTS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110] as const;

/**
 * Get max usage count for a slot
 */
export function getSlotMaxUsage(slot: number): number {
  if ((MULTI_USE_SLOTS as readonly number[]).includes(slot)) {
    return 3;
  }
  return 1;
}

/**
 * Create sponsor ad input type
 */
export interface CreateSponsorAdInput {
  userId: string;
  title: string;
  description?: string;
  media: string[];
  image?: string;
  state: string;
  city: string;
  category: string;
  subcategory?: string;
  slot: AdSlot;
  phoneNumber?: string;
  website?: string;
  tag?: AdTagType;
}

/**
 * Create a new sponsor ad (admin only)
 * Note: slot is stored as (displaySlot - 1) in database
 */
export async function createSponsorAd(input: CreateSponsorAdInput): Promise<SponsorAd> {
  try {
    const storedSlot = input.slot - 1;
    const maxUsage = getSlotMaxUsage(input.slot);
    // Slot scarcity is scoped per tag (Home / Event / Exchange) — the admin grid is
    // segmented by tag, so the "slot full" guard must be too. Treat missing tag as "".
    const slotTag = input.tag || "";
    const existing = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      [
        Query.equal("isAdminCreated", true),
        Query.equal("slot", storedSlot),
        Query.equal("tag", slotTag),
        Query.limit(maxUsage + 1),
      ]
    );
    if (existing.total >= maxUsage) {
      throw new Error(`Slot ${input.slot} is already full (max ${maxUsage})`);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const doc = await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      ID.unique(),
      {
        userId: input.userId,
        title: input.title,
        description: input.description || "",
        media: input.media,
        image: input.image || "",
        state: input.state,
        city: input.city,
        category: input.category,
        subcategory: input.subcategory || "",
        slot: input.slot - 1, // Store as slot - 1
        status: "active",
        views: 0,
        clicks: 0,
        expiresAt: expiresAt.toISOString(),
        isBlacklisted: false,
        isAdminCreated: true, // Mark as admin-created ad
        phoneNumber: input.phoneNumber || "",
        website: input.website || "",
        tag: input.tag || "",
      }
    );

    return doc as unknown as SponsorAd;
  } catch (error) {
    console.error("Error creating sponsor ad:", error);
    throw error;
  }
}

/**
 * Slot usage info - how many times each slot is used
 */
export interface SlotUsageInfo {
  [slot: number]: number;
}

/**
 * Get slot usage counts (how many times each slot is used by admin-created active ads)
 * Only checks admin-created ads - regular user ads don't affect admin slot availability
 * Note: Database stores slot as (displaySlot - 1), so we convert back to display value
 *
 * Slots are scoped per tag (Home / Event / Exchange). Pass `tag` to count usage
 * within that tab only; omit it to count across every tab (legacy behaviour).
 */
export async function getSlotUsageCounts(tag?: AdTagType): Promise<SlotUsageInfo> {
  try {
    const queries = [
      Query.equal("isAdminCreated", true),
      Query.isNotNull("slot"),
      Query.limit(1000),
    ];
    if (tag !== undefined) {
      queries.push(Query.equal("tag", tag));
    }
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SPONSOR_ADS,
      queries
    );

    const usageCounts: SlotUsageInfo = {};
    
    res.documents.forEach((doc) => {
      const storedSlot = doc.slot as number | undefined;
      if (storedSlot !== undefined && storedSlot !== null) {
        const displaySlot = storedSlot + 1; // Convert back to display value
        usageCounts[displaySlot] = (usageCounts[displaySlot] || 0) + 1;
      }
    });

    return usageCounts;
  } catch (error) {
    console.error("Error fetching slot usage counts:", error);
    return {};
  }
}

/**
 * Check if a slot is available for use
 */
export function isSlotAvailable(slot: number, usageCounts: SlotUsageInfo): boolean {
  const currentUsage = usageCounts[slot] || 0;
  const maxUsage = getSlotMaxUsage(slot);
  return currentUsage < maxUsage;
}

/**
 * Get remaining usage count for a slot
 */
export function getSlotRemainingUsage(slot: number, usageCounts: SlotUsageInfo): number {
  const currentUsage = usageCounts[slot] || 0;
  const maxUsage = getSlotMaxUsage(slot);
  return Math.max(0, maxUsage - currentUsage);
}

// ==================== User Registration Stats ====================

export interface RegistrationStats {
  totalUsers: number;
  dailyRegistrations: number; // Daily registrations
  monthlyRegistrations: number; // Monthly registrations
  yearlyRegistrations: number; // Yearly registrations
}

export interface DailyRegistrationTrend {
  day: number;
  count: number;
}

export interface MonthlyRegistrationTrend {
  month: number;
  count: number;
}

// Helper to format date as YYYY-MM-DD in local timezone
const formatLocalDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Get user registration statistics for a specific date
 */
export async function getRegistrationStats(
  year: number,
  month: number,
  day: number
): Promise<RegistrationStats> {
  try {
    // Get total users
    const totalRes = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      [Query.limit(1)]
    );
    const totalUsers = totalRes.total;

    // Get all profiles to analyze registration dates
    const allProfiles = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      [Query.limit(10000)]
    );

    // Calculate daily, monthly, yearly registrations
    let dailyRegistrations = 0;
    let monthlyRegistrations = 0;
    let yearlyRegistrations = 0;

    // Use local timezone for date comparison
    const targetDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    allProfiles.documents.forEach((doc) => {
      const createdAt = new Date(doc.$createdAt);
      // Use local timezone
      const createdDateStr = formatLocalDate(createdAt);
      const createdYear = createdAt.getFullYear();
      const createdMonth = createdAt.getMonth() + 1;

      // Same day (local timezone)
      if (createdDateStr === targetDateStr) {
        dailyRegistrations++;
      }

      // Same month and year (local timezone)
      if (createdYear === year && createdMonth === month) {
        monthlyRegistrations++;
      }

      // Same year (local timezone)
      if (createdYear === year) {
        yearlyRegistrations++;
      }
    });

    return {
      totalUsers,
      dailyRegistrations,
      monthlyRegistrations,
      yearlyRegistrations,
    };
  } catch (error) {
    console.error("Error fetching registration stats:", error);
    return {
      totalUsers: 0,
      dailyRegistrations: 0,
      monthlyRegistrations: 0,
      yearlyRegistrations: 0,
    };
  }
}

/**
 * Get daily registration trend for a specific month
 */
export async function getDailyRegistrationTrend(
  year: number,
  month: number
): Promise<DailyRegistrationTrend[]> {
  try {
    const allProfiles = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      [Query.limit(10000)]
    );

    // Get days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyCounts: DailyRegistrationTrend[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      // Use local timezone for date comparison
      const targetDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const count = allProfiles.documents.filter((doc) => {
        const createdAt = new Date(doc.$createdAt);
        return formatLocalDate(createdAt) === targetDateStr;
      }).length;

      dailyCounts.push({ day, count });
    }

    return dailyCounts;
  } catch (error) {
    console.error("Error fetching daily registration trend:", error);
    return [];
  }
}

/**
 * Get monthly registration trend for a specific year
 */
export async function getMonthlyRegistrationTrend(
  year: number
): Promise<MonthlyRegistrationTrend[]> {
  try {
    const allProfiles = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PROFILE,
      [Query.limit(10000)]
    );

    const monthlyCounts: MonthlyRegistrationTrend[] = [];

    for (let month = 1; month <= 12; month++) {
      const count = allProfiles.documents.filter((doc) => {
        const createdAt = new Date(doc.$createdAt);
        return (
          createdAt.getFullYear() === year && createdAt.getMonth() + 1 === month
        );
      }).length;

      monthlyCounts.push({ month, count });
    }

    return monthlyCounts;
  } catch (error) {
    console.error("Error fetching monthly registration trend:", error);
    return [];
  }
}
