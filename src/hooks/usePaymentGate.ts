"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type ItemType = "tournament" | "scoreboard";

const PRICES = {
  tournament: "₦20,000",
  scoreboard: "₦2,000",
} as const;

export function usePaymentGate(itemType: ItemType) {
  const [isFree, setIsFree] = useState<boolean | null>(null); // null = loading
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkFreeSlot = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("free_tournament_used, free_scoreboard_used")
        .eq("id", user.id)
        .single();

      if (profile) {
        const used = itemType === "tournament" ? profile.free_tournament_used : profile.free_scoreboard_used;
        setIsFree(!used);
      }
    };

    checkFreeSlot();
  }, [itemType]);

  const getButtonLabel = () => {
    if (isFree === null) return "Loading...";
    if (isFree) {
      return itemType === "tournament" ? "Create Tournament" : "Create Match";
    }
    return `Pay ${PRICES[itemType]} & Create`;
  };

  const initializePayment = async (
    metadata: Record<string, unknown>
  ): Promise<{ free: true; item_id: string } | { free: false; authorization_url: string }> => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_type: itemType,
          currency: "NGN",
          item_metadata: metadata,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment initialization failed");
      }

      return await res.json();
    } finally {
      setLoading(false);
    }
  };

  return { isFree, loading, getButtonLabel, initializePayment };
}
