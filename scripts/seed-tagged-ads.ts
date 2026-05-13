/**
 * Seed a few sample admin ads with tag (home / event / exchange)
 *
 * Run with:
 *   npx ts-node scripts/seed-tagged-ads.ts
 */

import { Client, Databases, ID, Query } from "node-appwrite";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
const DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "";

const SPONSOR_ADS_COLLECTION = "sponsor_ads";

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const db = new Databases(client);

const SAMPLE_ADS = [
  // --- HOME (3) ---
  { slot: 1,  tag: "home", cat: "technology-development", sub: "web-development",  title: "[Home] CodeCraft Academy — Learn to Code",  desc: "Intensive coding bootcamp with job guarantee.", phone: "(415) 555-0101", website: "https://codecraft.academy", state: "California", city: "San Francisco" },
  { slot: 5,  tag: "home", cat: "creative-design",        sub: "graphic-design",   title: "[Home] Canva Pro — Design Anything",          desc: "Create stunning graphics, presentations, videos.", phone: "(213) 555-0103", website: "https://canva.com", state: "California", city: "Los Angeles" },
  { slot: 8,  tag: "home", cat: "marketing-business",      sub: "digital-marketing", title: "[Home] GrowthEngine — Automate Marketing", desc: "AI-powered marketing automation. 50% off first 3 months.", phone: "(212) 555-0104", website: "https://growthengine.io", state: "New York", city: "New York" },

  // --- EVENT (3) ---
  { slot: 1,  tag: "event", cat: "education-learning",    sub: "online-courses",    title: "[Event] SkillForge — Master New Skills",     desc: "10,000+ courses from industry experts.", phone: "(206) 555-0107", website: "https://skillforge.com", state: "Washington", city: "Seattle" },
  { slot: 5,  tag: "event", cat: "lifestyle-personal-services", sub: "fitness-training", title: "[Event] FitLife App — AI Trainer",     desc: "Custom workout plans and progress analytics.", phone: "(512) 555-0108", website: "https://fitlife.app", state: "Texas", city: "Austin" },
  { slot: 10, tag: "event", cat: "creative-design",       sub: "videography",       title: "[Event] Frame.io — Video Collaboration",     desc: "Streamline your video review and approval.", phone: "(646) 555-0112", website: "https://frame.io", state: "New York", city: "Brooklyn" },

  // --- EXCHANGE (3) ---
  { slot: 1,  tag: "exchange", cat: "trades-skilled-work", sub: "construction-renovation", title: "[Exchange] BuildRight Supply Co.",  desc: "Quality lumber, hardware and tools at contractor prices.", phone: "(303) 555-0109", website: "https://buildright.co", state: "Colorado", city: "Denver" },
  { slot: 5,  tag: "exchange", cat: "local-opportunities", sub: "jobs",              title: "[Exchange] TalentBridge — Dream Job",       desc: "AI-powered job matching for top talent.", phone: "(404) 555-0110", website: "https://talentbridge.io", state: "Georgia", city: "Atlanta" },
  { slot: 8,  tag: "exchange", cat: "local-opportunities", sub: "house-rentals",     title: "[Exchange] Apartments.com — Find Home",     desc: "Search millions of apartments. Virtual tours.", phone: "(404) 555-0118", website: "https://apartments.com", state: "Georgia", city: "Atlanta" },
];

async function main() {
  console.log("Seeding 9 tagged sample ads (3 per tag)...\n");

  let adminUserId = "admin-seed-user";
  try {
    const profiles = await db.listDocuments(DATABASE_ID, "profile", [
      Query.limit(1),
    ]);
    if (profiles.documents.length > 0) {
      adminUserId = (profiles.documents[0] as any).userId;
      console.log(`Using userId: ${adminUserId}`);
    }
  } catch {
    console.log("Could not fetch profiles, using fallback userId");
  }

  let created = 0;
  for (const ad of SAMPLE_ADS) {
    const storedSlot = ad.slot - 1;
    const img = `https://picsum.photos/seed/${ad.tag}${ad.slot}/800/800`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    try {
      await db.createDocument(DATABASE_ID, SPONSOR_ADS_COLLECTION, ID.unique(), {
        userId: adminUserId,
        title: ad.title,
        description: ad.desc,
        media: [img],
        state: ad.state,
        city: ad.city,
        category: ad.cat,
        subcategory: ad.sub,
        slot: storedSlot,
        phoneNumber: ad.phone,
        website: ad.website,
        status: "active",
        views: Math.floor(Math.random() * 500) + 50,
        clicks: Math.floor(Math.random() * 80) + 5,
        expiresAt: expiresAt.toISOString(),
        isBlacklisted: false,
        isAdminCreated: true,
        tag: ad.tag,
      });
      created++;
      console.log(`  [${ad.tag}] Slot ${ad.slot}: ${ad.title}`);
    } catch (err: any) {
      console.error(`  FAIL [${ad.tag}] Slot ${ad.slot}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nDone! Created ${created}/${SAMPLE_ADS.length} tagged ads.`);
}

main().catch(console.error);
