import { databases, Collections, Query } from "./appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

// Category type definition
export interface Category {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  categoryId: string;
  type: "category" | "subcategory";
  parentId?: string;      // 父分类的 value
  value: string;          // 代码中的值
  name: string;
  icon: string;           // Ionicons 图标名
  colorStart?: string;    // 渐变起始色
  colorEnd?: string;      // 渐变结束色
  order: number;
}

/**
 * Get all categories (main categories only)
 */
export const getCategories = async (): Promise<Category[]> => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      Collections.CATEGORIES,
      [
        Query.equal("type", "category"),
        Query.orderAsc("order"),
        Query.limit(100),
      ]
    );
    return response.documents as unknown as Category[];
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

/**
 * Get all subcategories for a parent category
 * @param parentValue - 父分类的 value 字段
 */
export const getSubcategories = async (parentValue: string): Promise<Category[]> => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      Collections.CATEGORIES,
      [
        Query.equal("type", "subcategory"),
        Query.equal("parentId", parentValue),
        Query.orderAsc("order"),
        Query.limit(100),
      ]
    );
    return response.documents as unknown as Category[];
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    return [];
  }
};

/**
 * Get all categories and subcategories
 */
export const getAllCategories = async (): Promise<Category[]> => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      Collections.CATEGORIES,
      [
        Query.orderAsc("order"),
        Query.limit(500),
      ]
    );
    return response.documents as unknown as Category[];
  } catch (error) {
    console.error("Error fetching all categories:", error);
    return [];
  }
};

/**
 * Update a category
 */
export const updateCategory = async (
  documentId: string,
  data: Partial<Omit<Category, "$id" | "$createdAt" | "$updatedAt">>
): Promise<Category | null> => {
  try {
    const response = await databases.updateDocument(
      DATABASE_ID,
      Collections.CATEGORIES,
      documentId,
      data
    );
    return response as unknown as Category;
  } catch (error) {
    console.error("Error updating category:", error);
    throw error;
  }
};

/**
 * Delete a category
 * Note: This will also delete all subcategories if it's a main category
 * @param documentId - 文档 ID
 * @param value - 分类的 value 字段（用于删除子分类）
 */
export const deleteCategory = async (
  documentId: string,
  value?: string
): Promise<boolean> => {
  try {
    // If it's a main category, delete all its subcategories first
    if (value) {
      const subcategories = await getSubcategories(value);
      for (const sub of subcategories) {
        await databases.deleteDocument(
          DATABASE_ID,
          Collections.CATEGORIES,
          sub.$id
        );
      }
    }
    
    // Delete the category itself
    await databases.deleteDocument(
      DATABASE_ID,
      Collections.CATEGORIES,
      documentId
    );
    return true;
  } catch (error) {
    console.error("Error deleting category:", error);
    return false;
  }
};

/**
 * Create a new category
 */
export const createCategory = async (
  data: Omit<Category, "$id" | "$createdAt" | "$updatedAt">
): Promise<Category | null> => {
  try {
    const response = await databases.createDocument(
      DATABASE_ID,
      Collections.CATEGORIES,
      "unique()",
      data
    );
    return response as unknown as Category;
  } catch (error) {
    console.error("Error creating category:", error);
    throw error;
  }
};

// ============ Sponsor Ads Related ============

export interface SponsorAd {
  $id: string;
  userId: string;
  category: string;
  subcategory: string;
  slot: number;
  $createdAt: string;
}

export interface AdSlotUser {
  ad: SponsorAd;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  } | null;
  plan: {
    name: string;
  } | null;
  slotLabel: string;
}

// Slot 位置规则映射
const SLOT_RULES: Record<number, { plan: string; label: string }> = {
  0: { plan: "Dominion", label: "Feed #1" },
  1: { plan: "Essential/Professional", label: "Preference #1" },
  2: { plan: "Essential/Professional", label: "Preference #2" },
  3: { plan: "Essential/Professional", label: "Preference #3" },
  9: { plan: "Dominion", label: "Feed #10" },
  19: { plan: "Dominion", label: "Feed #20" },
};

/**
 * Get slot label based on slot number
 */
export const getSlotLabel = (slot: number): string => {
  const rule = SLOT_RULES[slot];
  if (rule) {
    return `${rule.label} (${rule.plan})`;
  }
  return `Slot #${slot}`;
};

/**
 * Get sponsor ads for a specific subcategory
 */
export const getSubcategorySponsorAds = async (
  categoryValue: string,
  subcategoryValue: string
): Promise<AdSlotUser[]> => {
  try {
    // 1. Query sponsor_ads by category and subcategory
    const adsRes = await databases.listDocuments(
      DATABASE_ID,
      Collections.SPONSOR_ADS,
      [
        Query.equal("category", categoryValue),
        Query.equal("subcategory", subcategoryValue),
        Query.limit(100),
      ]
    );
    const ads = adsRes.documents as unknown as SponsorAd[];

    if (ads.length === 0) return [];

    // 2. Get unique userIds
    const userIds = [...new Set(ads.map((ad) => ad.userId))];

    // 3. Batch query profiles
    const profilePromises = userIds.map((userId) =>
      databases.listDocuments(DATABASE_ID, Collections.PROFILE, [
        Query.equal("userId", userId),
        Query.limit(1),
      ])
    );
    const profileResults = await Promise.all(profilePromises);
    const profileMap = new Map<string, { firstName: string; lastName: string; email: string; avatar?: string }>();
    
    profileResults.forEach((res, idx) => {
      if (res.documents.length > 0) {
        const doc = res.documents[0] as unknown as {
          userId: string;
          firstName: string;
          lastName: string;
          email: string;
          avatar?: string;
        };
        profileMap.set(userIds[idx], {
          firstName: doc.firstName || "",
          lastName: doc.lastName || "",
          email: doc.email || "",
          avatar: doc.avatar,
        });
      }
    });

    // 4. Batch query subscriptions to get planId
    const subPromises = userIds.map((userId) =>
      databases.listDocuments(DATABASE_ID, Collections.SUBSCRIPTIONS, [
        Query.equal("userId", userId),
        Query.limit(1),
      ])
    );
    const subResults = await Promise.all(subPromises);
    const userPlanIdMap = new Map<string, string>();
    
    subResults.forEach((res, idx) => {
      if (res.documents.length > 0) {
        const doc = res.documents[0] as unknown as { userId: string; planId: string };
        userPlanIdMap.set(userIds[idx], doc.planId);
      }
    });

    // 5. Get unique planIds and query Plans
    const planIds = [...new Set(Array.from(userPlanIdMap.values()))];
    const planMap = new Map<string, { name: string }>();
    
    if (planIds.length > 0) {
      const plansRes = await databases.listDocuments(DATABASE_ID, Collections.PLANS, [
        Query.limit(100),
      ]);
      (plansRes.documents as unknown as { $id: string; name: string }[]).forEach((plan) => {
        planMap.set(plan.$id, { name: plan.name });
      });
    }

    // 6. Combine all data
    const result: AdSlotUser[] = ads.map((ad) => {
      const user = profileMap.get(ad.userId) || null;
      const planId = userPlanIdMap.get(ad.userId);
      const plan = planId ? planMap.get(planId) || null : null;
      const slotLabel = getSlotLabel(ad.slot);

      return {
        ad,
        user,
        plan,
        slotLabel,
      };
    });

    // Sort by slot number
    result.sort((a, b) => a.ad.slot - b.ad.slot);

    return result;
  } catch (error) {
    console.error("Error fetching subcategory sponsor ads:", error);
    return [];
  }
};
