/**
 * Server-only Paystack API wrapper.
 * Uses fetch — no npm package needed.
 */

const PAYSTACK_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY environment variable");
  return key;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
  };
}

export interface InitializeParams {
  email: string;
  amount: number; // in kobo (NGN) or cents (USD)
  currency: "NGN" | "USD";
  reference: string;
  callback_url: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(
  params: InitializeParams
): Promise<InitializeResponse> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });

  const json = await res.json();

  if (!json.status) {
    throw new Error(json.message || "Failed to initialize Paystack transaction");
  }

  return json.data as InitializeResponse;
}

export interface VerifyResponse {
  status: string; // "success", "failed", "abandoned"
  reference: string;
  amount: number;
  currency: string;
  customer: { email: string };
  metadata: Record<string, unknown> | null;
}

export async function verifyTransaction(
  reference: string
): Promise<VerifyResponse> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET", headers: headers() }
  );

  const json = await res.json();

  if (!json.status) {
    throw new Error(json.message || "Failed to verify Paystack transaction");
  }

  return json.data as VerifyResponse;
}

/**
 * Verify Paystack webhook signature (HMAC SHA-512).
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string
): Promise<boolean> {
  const key = getSecretKey();
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(body));
  const hash = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash === signature;
}
