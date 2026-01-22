import { Collections, databases, Query } from "./appwrite";
import { Models } from "appwrite";

export interface Plan extends Models.Document {
  name: string;
  priceMonthly: number;
  priceYearly: number;
}

export interface Subscription extends Models.Document {
  userId: string;
  planId: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  currentPeriodStart: string;
}

export interface SubscriptionStats {
  activeUsers: number;           // 订阅人数
  churnedUsers: number;          // 退订人数
  churnRate: number;             // 退订率
  monthlyRevenue: number;        // 月收入
  revenueByTier: {               // 按套餐分布的收入
    planId: string;
    planName: string;
    revenue: number;
    count: number;
    color: string;
  }[];
}

// 套餐颜色映射 - 根据关键词匹配
const PLAN_COLOR_KEYWORDS: { keyword: string; color: string }[] = [
  { keyword: "essential", color: "#22c55e" },      // 绿色
  { keyword: "professional", color: "#3b82f6" },   // 蓝色
  { keyword: "dominion", color: "#b91c1c" },       // 红色
];

/**
 * 根据套餐名称获取颜色
 */
function getPlanColor(planName: string): string {
  const lowerName = planName.toLowerCase();
  for (const { keyword, color } of PLAN_COLOR_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return color;
    }
  }
  return "#666666"; // 默认灰色
}

/**
 * 获取订阅统计数据
 */
export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  try {
    // 1. 获取所有订阅记录
    const subscriptionsRes = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SUBSCRIPTIONS,
      [Query.limit(1000)]
    );
    const subscriptions = subscriptionsRes.documents as Subscription[];

    // 2. 获取所有套餐
    const plansRes = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PLANS,
      [Query.limit(100)]
    );
    const plans = plansRes.documents as Plan[];
    const planMap = new Map<string, Plan>();
    plans.forEach((p) => planMap.set(p.$id, p));

    // 3. 计算统计数据
    const totalUsers = subscriptions.length;
    const churnedUsers = subscriptions.filter((s) => s.cancelAtPeriodEnd === true).length;
    const churnRate = totalUsers > 0 ? (churnedUsers / totalUsers) * 100 : 0;

    // 4. 计算月收入和按套餐分布
    const revenueByPlan = new Map<string, { revenue: number; count: number }>();
    let monthlyRevenue = 0;

    subscriptions.forEach((sub) => {
      const plan = planMap.get(sub.planId);
      if (plan) {
        const price = plan.priceMonthly || 0;
        monthlyRevenue += price;

        const existing = revenueByPlan.get(sub.planId) || { revenue: 0, count: 0 };
        revenueByPlan.set(sub.planId, {
          revenue: existing.revenue + price,
          count: existing.count + 1,
        });
      }
    });

    // 5. 构建按套餐分布数据
    const revenueByTier = Array.from(revenueByPlan.entries()).map(([planId, data]) => {
      const plan = planMap.get(planId);
      const planName = plan?.name || "Unknown";
      const color = getPlanColor(planName);

      return {
        planId,
        planName,
        revenue: data.revenue,
        count: data.count,
        color,
      };
    });

    // 按收入降序排序
    revenueByTier.sort((a, b) => b.revenue - a.revenue);

    return {
      activeUsers: totalUsers,
      churnedUsers,
      churnRate,
      monthlyRevenue,
      revenueByTier,
    };
  } catch (error) {
    console.error("Failed to fetch subscription stats:", error);
    return {
      activeUsers: 0,
      churnedUsers: 0,
      churnRate: 0,
      monthlyRevenue: 0,
      revenueByTier: [],
    };
  }
}

/**
 * 日活月活统计结果
 */
export interface ActivityStats {
  dailyActive: number;      // 日活
  monthlyActive: number;    // 月活
  date: string;             // 统计日期 YYYY-MM-DD
  year: number;
  month: number;
}

/**
 * 日活趋势数据点
 */
export interface DailyTrendPoint {
  day: number;
  date: string;
  count: number;
}

/**
 * 月活趋势数据点
 */
export interface MonthlyTrendPoint {
  year: number;
  month: number;
  label: string;
  count: number;
}

/**
 * 活跃度趋势数据
 */
export interface ActivityTrend {
  dailyTrend: DailyTrendPoint[];    // 当月每天的日活
  monthlyTrend: MonthlyTrendPoint[]; // 近6个月的月活
  totalDailyActive: number;          // 当天日活
  totalMonthlyActive: number;        // 当月月活
}

/**
 * 获取活跃度趋势数据
 * @param year 年份
 * @param month 月份 (1-12)
 * @param day 日期 (1-31)
 */
export async function getActivityTrend(
  year: number,
  month: number,
  day: number
): Promise<ActivityTrend> {
  try {
    // 获取所有订阅记录
    const subscriptionsRes = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SUBSCRIPTIONS,
      [Query.limit(5000)]
    );
    const subscriptions = subscriptionsRes.documents as Subscription[];

    // 计算当月天数
    const daysInMonth = new Date(year, month, 0).getDate();

    // 构建当月每天的日活数据
    const dailyTrend: DailyTrendPoint[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const count = subscriptions.filter((sub) => {
        if (!sub.currentPeriodStart) return false;
        return sub.currentPeriodStart.split("T")[0] === dateStr;
      }).length;
      dailyTrend.push({ day: d, date: dateStr, count });
    }

    // 构建近6个月的月活数据
    const monthlyTrend: MonthlyTrendPoint[] = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 5; i >= 0; i--) {
      let targetYear = year;
      let targetMonth = month - i;
      
      // 处理跨年
      while (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      }

      const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
      const count = subscriptions.filter((sub) => {
        if (!sub.currentPeriodStart) return false;
        return sub.currentPeriodStart.split("T")[0].startsWith(monthPrefix);
      }).length;

      monthlyTrend.push({
        year: targetYear,
        month: targetMonth,
        label: `${monthNames[targetMonth - 1]} ${targetYear}`,
        count,
      });
    }

    // 当天日活
    const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const totalDailyActive = subscriptions.filter((sub) => {
      if (!sub.currentPeriodStart) return false;
      return sub.currentPeriodStart.split("T")[0] === todayStr;
    }).length;

    // 当月月活
    const currentMonthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const totalMonthlyActive = subscriptions.filter((sub) => {
      if (!sub.currentPeriodStart) return false;
      return sub.currentPeriodStart.split("T")[0].startsWith(currentMonthPrefix);
    }).length;

    return {
      dailyTrend,
      monthlyTrend,
      totalDailyActive,
      totalMonthlyActive,
    };
  } catch (error) {
    console.error("Failed to fetch activity trend:", error);
    return {
      dailyTrend: [],
      monthlyTrend: [],
      totalDailyActive: 0,
      totalMonthlyActive: 0,
    };
  }
}

/**
 * 获取日活月活统计
 * @param year 年份
 * @param month 月份 (1-12)
 * @param day 日期 (1-31)，用于计算日活
 */
export async function getActivityStats(
  year: number,
  month: number,
  day?: number
): Promise<ActivityStats> {
  try {
    // 获取所有订阅记录
    const subscriptionsRes = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.SUBSCRIPTIONS,
      [Query.limit(5000)]
    );
    const subscriptions = subscriptionsRes.documents as Subscription[];

    // 计算日活：currentPeriodStart 与指定日期是同一天
    const targetDate = day
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : `${year}-${String(month).padStart(2, "0")}-01`;

    const dailyActive = subscriptions.filter((sub) => {
      if (!sub.currentPeriodStart) return false;
      const startDate = sub.currentPeriodStart.split("T")[0]; // 提取 YYYY-MM-DD
      return startDate === targetDate;
    }).length;

    // 计算月活：currentPeriodStart 在指定年月内
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const monthlyActive = subscriptions.filter((sub) => {
      if (!sub.currentPeriodStart) return false;
      const startDate = sub.currentPeriodStart.split("T")[0];
      return startDate.startsWith(monthPrefix);
    }).length;

    return {
      dailyActive,
      monthlyActive,
      date: targetDate,
      year,
      month,
    };
  } catch (error) {
    console.error("Failed to fetch activity stats:", error);
    return {
      dailyActive: 0,
      monthlyActive: 0,
      date: "",
      year,
      month,
    };
  }
}

/**
 * 获取所有套餐
 */
export async function getAllPlans(): Promise<Plan[]> {
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      Collections.PLANS,
      [Query.orderAsc("priceMonthly")]
    );
    return res.documents as Plan[];
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    return [];
  }
}

/**
 * 获取订阅列表（带分页）
 */
export interface SubscriptionListParams {
  page?: number;
  limit?: number;
  planId?: string;
}

export interface SubscriptionListResult {
  subscriptions: (Subscription & { plan?: Plan })[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getSubscriptions(
  params: SubscriptionListParams = {}
): Promise<SubscriptionListResult> {
  const { page = 1, limit = 20, planId } = params;
  const offset = (page - 1) * limit;

  try {
    const queries: string[] = [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ];

    if (planId && planId !== "all") {
      queries.push(Query.equal("planId", planId));
    }

    const [subsRes, plansRes] = await Promise.all([
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.SUBSCRIPTIONS,
        queries
      ),
      databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        Collections.PLANS,
        [Query.limit(100)]
      ),
    ]);

    const planMap = new Map<string, Plan>();
    (plansRes.documents as Plan[]).forEach((p) => planMap.set(p.$id, p));

    const subscriptions = (subsRes.documents as Subscription[]).map((sub) => ({
      ...sub,
      plan: planMap.get(sub.planId),
    }));

    return {
      subscriptions,
      total: subsRes.total,
      page,
      totalPages: Math.ceil(subsRes.total / limit),
    };
  } catch (error) {
    console.error("Failed to fetch subscriptions:", error);
    return {
      subscriptions: [],
      total: 0,
      page,
      totalPages: 0,
    };
  }
}
