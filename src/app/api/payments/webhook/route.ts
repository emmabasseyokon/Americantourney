import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/paystack";
import { sanitizeString } from "@/lib/utils/security";
import { createInitialState } from "@/lib/scoreboard/tennis";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature") || "";

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(body, signature);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Only handle successful charges
    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const reference = event.data?.reference;
    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    // Double-verify with Paystack API
    const verification = await verifyTransaction(reference);
    if (verification.status !== "success") {
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceRoleClient();

    // Get payment record
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("paystack_reference", reference)
      .single();

    if (!payment) {
      console.error("Webhook: payment not found for reference", reference);
      return NextResponse.json({ received: true });
    }

    // Update payment status
    await supabase
      .from("payments")
      .update({ status: "success" })
      .eq("id", payment.id);

    // Create item if not already created (idempotent — callback may have beaten us)
    if (!payment.created_item_id) {
      const itemId = await createItem(
        supabase,
        payment.user_id,
        payment.item_type,
        payment.item_metadata || {}
      );

      // Only update if still null (race guard)
      await supabase
        .from("payments")
        .update({ created_item_id: itemId })
        .eq("id", payment.id)
        .is("created_item_id", null);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function createItem(
  supabase: ReturnType<typeof createServiceRoleClient>,
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
      format: metadata.format === "junior" ? "junior" : "standard",
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
