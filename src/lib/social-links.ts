/**
 * Same shape as the mobile app `business_profile.socialLinks` (Text JSON or object).
 * Prefer `NEXT_PUBLIC_BP_SOCIAL_READ_KEYS` in Admin; falls back to `EXPO_PUBLIC_*` if set.
 */

export const SOCIAL_LINK_KEYS = [
  "website",
  "facebook",
  "instagram",
  "youtube",
  "twitter",
  "tiktok",
] as const;

export type SocialLinksPayload = Partial<
  Record<(typeof SOCIAL_LINK_KEYS)[number], string>
>;

export type SocialLinksStored = string | Record<string, unknown> | null | undefined;

export function getBpSocialLinksReadKeys(): string[] {
  const raw =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_BP_SOCIAL_READ_KEYS ||
      process.env.EXPO_PUBLIC_BP_SOCIAL_READ_KEYS);
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return ["socialLinks", "socialLinks_new"];
}

export function parseSocialLinks(raw: SocialLinksStored): SocialLinksPayload {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const out: SocialLinksPayload = {};
    for (const k of SOCIAL_LINK_KEYS) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  }
  const t = String(raw).trim();
  if (!t) return {};
  if (!t.startsWith("{")) {
    return { website: t };
  }
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const out: SocialLinksPayload = {};
    for (const k of SOCIAL_LINK_KEYS) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function mergeSocialLinksFromDoc(doc: Record<string, unknown>): SocialLinksPayload {
  let merged: SocialLinksPayload = {};
  for (const key of getBpSocialLinksReadKeys()) {
    const raw = doc[key];
    if (raw == null) continue;
    if (typeof raw === "string" && !raw.trim()) continue;
    merged = {
      ...merged,
      ...parseSocialLinks(raw as SocialLinksStored),
    };
  }
  for (const k of SOCIAL_LINK_KEYS) {
    const v = doc[k];
    if (typeof v === "string" && v.trim()) merged[k] = v.trim();
  }
  return merged;
}
