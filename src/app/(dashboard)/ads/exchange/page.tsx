"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminExchangeAdsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ads/admin?tag=exchange");
  }, [router]);
  return null;
}
