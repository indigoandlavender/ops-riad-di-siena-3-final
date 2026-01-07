import { NextRequest, NextResponse } from "next/server";
import { getSheetData, rowsToObjects } from "@/lib/sheets";

// Normalize phone number - ensure it has + prefix
function normalizePhone(phone: string | number | undefined): string {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  if (cleaned.startsWith("'")) cleaned = cleaned.slice(1);
  if (cleaned && !cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData("Master_Guests");
    const allGuests = rowsToObjects<Record<string, string>>(data);

    // Deduplicate by booking_id (keep the last occurrence, which is the most recent)
    const guestMap = new Map<string, Record<string, string>>();
    for (const guest of allGuests) {
      if (guest.booking_id) {
        guestMap.set(guest.booking_id, guest);
      }
    }
    const guests = Array.from(guestMap.values());

    // Helper to check if booking is cancelled
    const isCancelled = (status: string) => {
      const s = (status || "").toLowerCase();
      return s === "cancelled" || s === "canceled";
    };

    // Get date from query param or use today
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    
    let targetDate: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = new Date(dateParam + "T00:00:00");
    } else {
      targetDate = new Date();
    }
    const todayStr = targetDate.toISOString().split("T")[0];

    // Filter for today's check-ins
    const checkIns = guests
      .filter((g) => {
        if (!g.check_in) return false;
        const checkInDate = g.check_in.split("T")[0];
        return checkInDate === todayStr && !isCancelled(g.status);
      })
      .map((g) => ({
        booking_id: g.booking_id || "",
        guest_name: [g.first_name, g.last_name].filter(Boolean).join(" ") || "Guest",
        room: g.room || "",
        property: g.property || "The Riad",
        arrival_time: g.arrival_time_confirmed || g.arrival_time_stated || "",
        check_in: g.check_in || "",
        check_out: g.check_out || "",
        nights: parseInt(g.nights || "1", 10),
        guests: parseInt(g.guests || g.adults || "2", 10),
        channel: g.source || "Direct",
        special_requests: g.special_requests || "",
        notes: g.notes || "",
        phone: normalizePhone(g.phone),
        email: g.email || "",
      }))
      .sort((a, b) => {
        // Sort by arrival time if available
        if (a.arrival_time && b.arrival_time) {
          return a.arrival_time.localeCompare(b.arrival_time);
        }
        if (a.arrival_time) return -1;
        if (b.arrival_time) return 1;
        return 0;
      });

    // Filter for today's check-outs
    const checkOuts = guests
      .filter((g) => {
        if (!g.check_out) return false;
        const checkOutDate = g.check_out.split("T")[0];
        return checkOutDate === todayStr && !isCancelled(g.status);
      })
      .map((g) => ({
        booking_id: g.booking_id || "",
        guest_name: [g.first_name, g.last_name].filter(Boolean).join(" ") || "Guest",
        room: g.room || "",
        property: g.property || "The Riad",
        arrival_time: "",
        check_in: g.check_in || "",
        check_out: g.check_out || "",
        nights: parseInt(g.nights || "1", 10),
        guests: parseInt(g.guests || g.adults || "2", 10),
        channel: g.source || "Direct",
        special_requests: g.special_requests || "",
        notes: g.notes || "",
        phone: normalizePhone(g.phone),
        email: g.email || "",
      }));

    return NextResponse.json({
      date: todayStr,
      checkIns,
      checkOuts,
    });
  } catch (error) {
    console.error("Staff API error:", error);
    return NextResponse.json(
      { error: "Could not load data" },
      { status: 500 }
    );
  }
}
