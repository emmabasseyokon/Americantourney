import { createClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/paystack";
import { sanitizeString } from "@/lib/utils/security";
import { createInitialState } from "@/lib/scoreboard/tennis";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(new URL("/dashboard", url.origin));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", url.origin));
  }

  try {
    // Verify with Paystack
    const verification = await verifyTransaction(reference);

    // Get our payment record
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("paystack_reference", reference)
      .eq("user_id", user.id)
      .single();

    if (!payment) {
      return NextResponse.redirect(new URL("/dashboard?payment=error", url.origin));
    }

    if (verification.status === "success") {
      // Update payment status
      await supabase
        .from("payments")
        .update({ status: "success" })
        .eq("id", payment.id);

      // Create item if not already created (idempotent — webhook may have beaten us)
      let itemId = payment.created_item_id;
      if (!itemId) {
        itemId = await createItem(supabase, user.id, payment.item_type, payment.item_metadata || {});
        await supabase
          .from("payments")
          .update({ created_item_id: itemId })
          .eq("id", payment.id)
          .is("created_item_id", null); // Only update if still null (race guard)
      }

      // Redirect to the created item
      const redirectPath = payment.item_type === "tournament"
        ? `/tournaments/${itemId}`
        : `/scoreboards/${itemId}`;
      return NextResponse.redirect(new URL(redirectPath, url.origin));
    }

    // Payment failed or abandoned
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id);

    const failPath = payment.item_type === "tournament"
      ? "/dashboard?payment=failed"
      : "/scoreboards?payment=failed";
    return NextResponse.redirect(new URL(failPath, url.origin));

  } catch (err) {
    console.error("Payment callback error:", err);
    return NextResponse.redirect(new URL("/dashboard?payment=error", url.origin));
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
        logo_url: metadata.logo_url ? String(metadata.logo_url) : null,
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
      logo_url: metadata.logo_url ? String(metadata.logo_url) : null,
      score_state: createInitialState(),
      status: "pending",
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}
