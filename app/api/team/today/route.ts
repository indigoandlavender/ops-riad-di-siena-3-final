import { NextRequest, NextResponse } from "next/server";
import { getAllGuests, MasterGuest } from "@/lib/supabase";

function normalizePhone(phone: string | number | undefined): string {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  if (cleaned.startsWith("'")) cleaned = cleaned.slice(1);
  if (cleaned && !cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const today = dateParam || new Date().toISOString().split("T")[0];

    const guests = await getAllGuests();

    // Filter active bookings for today
    const active = guests.filter((g) => {
      if (!g.check_in || !g.check_out) return false;
      if (g.status === "cancelled" || g.source === "Blocked" || g.source === "Blackout") return false;
      return g.check_in <= today && g.check_out >= today;
    });

    // Categorize
    const checkingIn = active.filter((g) => g.check_in === today);
    const checkingOut = active.filter((g) => g.check_out === today);
    const staying = active.filter((g) => g.check_in < today && g.check_out > today);

    const formatGuest = (g: MasterGuest) => ({
      id: g.id,
      booking_id: g.booking_id,
      name: `${g.first_name || ""} ${g.last_name || ""}`.trim(),
      phone: normalizePhone(g.phone),
      property: g.property,
      room: g.room,
      checkIn: g.check_in,
      checkOut: g.check_out,
      nights: g.nights,
      guests: g.guests,
      source: g.source,
      specialRequests: g.special_requests,
      arrivalTime: g.arrival_time_stated || g.arrival_time_confirmed,
      country: g.country,
    });

    return NextResponse.json({
      date: today,
      checkingIn: checkingIn.map(formatGuest),
      checkingOut: checkingOut.map(formatGuest),
      staying: staying.map(formatGuest),
      totalOccupied: active.length,
    });
  } catch (error) {
    console.error("Team today error:", error);
    return NextResponse.json({ error: "Failed to fetch today's guests" }, { status: 500 });
  }
}
