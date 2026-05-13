/**
 * Regenerate random views & clicks for admin-created sponsor ads (isAdminCreated=true).
 *
 * Run:
 *   npm run randomize-admin-ad-metrics
 *
 * Dry run (no writes):
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/randomize-admin-ad-views-clicks.ts --dry-run
 */

import { Client, Databases, Query } from "node-appwrite";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const SPONSOR_ADS_COLLECTION = "sponsor_ads";

const DRY_RUN = process.argv.includes("--dry-run");

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** views in [min, max], clicks <= views with pseudo-realistic CTR */
function randomMetrics(): { views: number; clicks: number } {
  const views = randomInt(800, 92_000);
  const ctr = 0.002 + Math.random() * 0.09; // ~0.2%–9.2%
  let clicks = Math.floor(views * ctr * (0.6 + Math.random() * 0.8));
  clicks = Math.min(clicks, views);
  clicks = Math.max(0, clicks);
  return { views, clicks };
}

async function main() {
  if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !DATABASE_ID) {
    console.error(
      "Missing env: NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY, NEXT_PUBLIC_APPWRITE_DATABASE_ID (.env.local)"
    );
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const db = new Databases(client);

  let offset = 0;
  const pageSize = 100;
  let totalUpdated = 0;

  console.log(DRY_RUN ? "Dry run — no documents will be updated.\n" : "Updating admin ads…\n");

  for (;;) {
    const res = await db.listDocuments(DATABASE_ID, SPONSOR_ADS_COLLECTION, [
      Query.equal("isAdminCreated", true),
      Query.limit(pageSize),
      Query.offset(offset),
    ]);

    if (res.documents.length === 0) break;

    for (const doc of res.documents) {
      const { views, clicks } = randomMetrics();
      const title = (doc as { title?: string }).title?.slice(0, 48) || doc.$id;
      if (DRY_RUN) {
        console.log(`  [dry-run] ${doc.$id}  "${title}"  → views=${views} clicks=${clicks}`);
      } else {
        await db.updateDocument(DATABASE_ID, SPONSOR_ADS_COLLECTION, doc.$id, {
          views,
          clicks,
        });
        console.log(`  updated ${doc.$id}  "${title}"  views=${views} clicks=${clicks}`);
      }
      totalUpdated++;
    }

    offset += pageSize;
    if (offset >= res.total) break;
  }

  console.log(`\nDone. ${DRY_RUN ? "Would update" : "Updated"} ${totalUpdated} admin ad(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
