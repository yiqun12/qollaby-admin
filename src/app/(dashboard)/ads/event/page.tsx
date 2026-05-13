"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminEventAdsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ads/admin?tag=event");
  }, [router]);
  return null;
}
