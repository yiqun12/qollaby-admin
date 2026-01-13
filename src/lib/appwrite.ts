import { Account, Client, Databases, Query } from "appwrite";

// Appwrite configuration - shared with mobile app
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export const databases = new Databases(client);

export const Collections = {
  USERS: "users",
  POSTS: "posts",
  POST_LIKES: "post_likes",
  FOLLOWS: "follows",
  PLANS: "plans",
  SUBSCRIPTIONS: "subscriptions",
  SUBSCRIPTION_LOGS: "subscription_logs",
  BUSINESS_PROFILE: "business_profile",
  PROFILE: "profile",
  REPORTS: "reports",
  CONVERSATIONS: "conversations",
  MESSAGES: "messages",
  BROADCAST_USAGE: "broadcast_usage",
  SPONSOR_ADS: "sponsor_ads",
  AD_LIKES: "ad_likes",
  PUSH_TOKENS: "push_tokens",
} as const;

export { Query };
export default client;

