import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/lib/paystack";
import { sanitizeString } from "@/lib/utils/security";
import { createInitialState } from "@/lib/scoreboard/tennis";
import { NextResponse } from "next/server";

const PRICES = {
  tournament: { NGN: 2_000_000 }, // ₦20,000
  scoreboard: { NGN: 200_000 },   // ₦2,000
} as const;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { item_type, currency, item_metadata } = body;

    if (!item_type || !["tournament", "scoreboard"].includes(item_type)) {
      return NextResponse.json({ error: "Invalid item_type" }, { status: 400 });
    }
    if (!currency || currency !== "NGN") {
      return NextResponse.json({ error: "Only NGN is supported" }, { status: 400 });
    }

    // Check if free slot is available (atomic update)
    const freeColumn = item_type === "tournament" ? "free_tournament_used" : "free_scoreboard_used";

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, free_tournament_used, free_scoreboard_used")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const isFree = !profile[freeColumn];

    if (isFree) {
      // Atomic claim: only succeeds if still false
      const { data: updated, error: updateErr } = await supabase
        .from("profiles")
        .update({ [freeColumn]: true })
        .eq("id", user.id)
        .eq(freeColumn, false)
        .select("id")
        .single();

      if (updateErr || !updated) {
        // Race condition — someone else claimed it
        return NextResponse.json({ error: "Free slot already used" }, { status: 409 });
      }

      // Create the item directly
      const itemId = await createItem(supabase, user.id, item_type, item_metadata);
      return NextResponse.json({ free: true, item_id: itemId });
    }

    // Paid flow: initialize Paystack transaction
    const amount = PRICES[item_type as keyof typeof PRICES].NGN;
    const reference = `tourney_${item_type}_${crypto.randomUUID()}`;

    // Store payment record with item metadata
    const { error: paymentErr } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        item_type,
        amount_kobo: amount,
        currency,
        paystack_reference: reference,
        status: "pending",
        item_metadata,
      });

    if (paymentErr) {
      return NextResponse.json({ error: "Unable to process payment. Please try again." }, { status: 500 });
    }

    // Get callback URL
    const origin = request.headers.get("origin") || request.headers.get("referer")?.replace(/\/[^/]*$/, "") || "";
    const callback_url = `${origin}/api/payments/callback`;

    const paystack = await initializeTransaction({
      email: user.email!,
      amount,
      currency: "NGN",
      reference,
      callback_url,
      metadata: { item_type, user_id: user.id },
    });

    // Store access code
    await supabase
      .from("payments")
      .update({ paystack_access_code: paystack.access_code })
      .eq("paystack_reference", reference);

    return NextResponse.json({
      free: false,
      authorization_url: paystack.authorization_url,
    });
  } catch (err) {
    console.error("Payment initialize error:", err);
    return NextResponse.json({ error: "Unable to process your request. Please try again." }, { status: 500 });
  }
}

async function createItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemType: string,
  metadata: Record<string, unknown>
): Promise<string> {
  if (itemType === "tournament") {
    const name = sanitizeString(String(metadata.name || ""), 100);
    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        name: name || "Untitled Tournament",
        total_rounds: Number(metadata.total_rounds) || 5,
        max_players: Number(metadata.max_players) || 32,
        status: "registration",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data.id;
  }

  // Scoreboard
  const p1 = sanitizeString(String(metadata.player1_name || ""), 50);
  const p2 = sanitizeString(String(metadata.player2_name || ""), 50);
  const { data, error } = await supabase
    .from("scoreboards")
    .insert({
      player1_name: p1 || "Player 1",
      player2_name: p2 || "Player 2",
      best_of: Number(metadata.best_of) || 3,
      sport_type: metadata.sport_type === "padel" ? "padel" : "tennis",
      golden_point: !!metadata.golden_point,
      court_name: metadata.court_name ? sanitizeString(String(metadata.court_name), 50) : null,
      score_state: createInitialState(),
      status: "pending",
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}
