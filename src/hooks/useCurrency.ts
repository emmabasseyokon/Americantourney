"use client";

import { useState, useEffect } from "react";

type Currency = "NGN" | "USD";

const STORAGE_KEY = "tourney-currency";

function detectCurrency(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === "Africa/Lagos" ? "NGN" : "USD";
  } catch {
    return "USD";
  }
}

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>("USD");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Currency | null;
    setCurrency(stored && ["NGN", "USD"].includes(stored) ? stored : detectCurrency());
  }, []);

  const toggleCurrency = () => {
    const next: Currency = currency === "NGN" ? "USD" : "NGN";
    setCurrency(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return { currency, toggleCurrency };
}
