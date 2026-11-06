"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Static export cannot issue a server redirect, so the home page forwards in the browser.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/");
  }, [router]);
  return null;
}
