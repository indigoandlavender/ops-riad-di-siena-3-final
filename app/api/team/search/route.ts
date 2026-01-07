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
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.toLowerCase().trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const data = await getSheetData("Master_Guests");
    const allGuests = rowsToObjects<Record<string, string>>(data);

    // Deduplicate by booking_id (keep the last occurrence)
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

    // Search by booking_id or guest name
    const results = guests
      .filter((g) => {
        if (isCancelled(g.status)) return false;
        
        const bookingId = (g.booking_id || "").toLowerCase();
        const firstName = (g.first_name || "").toLowerCase();
        const lastName = (g.last_name || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const guestName = (g.guest_name || "").toLowerCase();

        return (
          bookingId.includes(query) ||
          firstName.includes(query) ||
          lastName.includes(query) ||
          fullName.includes(query) ||
          guestName.includes(query)
        );
      })
      .map((g) => ({
        booking_id: g.booking_id || "",
        guest_name: [g.first_name, g.last_name].filter(Boolean).join(" ") || g.guest_name || "Guest",
        room: g.room || "",
        property: g.property || "The Riad",
        check_in: g.check_in || "",
        check_out: g.check_out || "",
        nights: parseInt(g.nights || "1", 10),
        guests: parseInt(g.guests || g.adults || "2", 10),
        channel: g.source || "Direct",
        phone: normalizePhone(g.phone),
        email: g.email || "",
        arrival_time: g.arrival_time_confirmed || g.arrival_time_stated || "",
        special_requests: g.special_requests || "",
        notes: g.notes || "",
      }))
      .sort((a, b) => {
        // Sort by check-in date descending (most recent first)
        if (a.check_in && b.check_in) {
          return b.check_in.localeCompare(a.check_in);
        }
        return 0;
      })
      .slice(0, 10); // Limit to 10 results

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
