"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdsPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/ads/admin");
  }, [router]);

  return null;
}
