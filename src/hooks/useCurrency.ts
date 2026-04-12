"use client";

// NGN only for now — USD can be added when Paystack enables it
export function useCurrency() {
  const currency = "NGN" as const;
  return { currency };
}
