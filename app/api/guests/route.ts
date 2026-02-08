import { NextRequest, NextResponse } from "next/server";
import { getAllGuests, updateGuestByBookingId, insertGuest, MasterGuest } from "@/lib/supabase";

function normalizePhone(phone: string | number | undefined): string {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  if (cleaned.startsWith("'")) cleaned = cleaned.slice(1);
  if (cleaned && !cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}

export async function GET() {
  try {
    const allGuests = await getAllGuests();

    // Deduplicate by booking_id (keep last occurrence)
    const guestMap = new Map<string, MasterGuest>();
    for (const guest of allGuests) {
      if (guest.booking_id) {
        guestMap.set(guest.booking_id, guest);
      }
    }
    const guests = Array.from(guestMap.values());

    const transformed = guests.map((g) => ({
      id: g.id,
      booking_id: g.booking_id,
      source: g.source,
      status: g.status,
      first_name: g.first_name,
      last_name: g.last_name,
      email: g.email,
      phone: normalizePhone(g.phone),
      country: g.country,
      language: g.language,
      property: g.property,
      room: g.room,
      check_in: g.check_in,
      check_out: g.check_out,
      nights: g.nights != null ? String(g.nights) : "",
      guests: g.guests != null ? String(g.guests) : "",
      adults: g.adults != null ? String(g.adults) : "",
      children: g.children != null ? String(g.children) : "",
      total_eur: g.total_eur != null ? String(g.total_eur) : "",
      city_tax: g.city_tax != null ? String(g.city_tax) : "",
      special_requests: g.special_requests,
      arrival_time_stated: g.arrival_time_stated,
      arrival_request_sent: g.arrival_request_sent,
      arrival_confirmed: g.arrival_confirmed,
      arrival_time_confirmed: g.arrival_time_confirmed,
      read_messages: g.read_messages,
      midstay_checkin: g.midstay_checkin,
      city_tax_paid: g.city_tax_paid,
      created_at: g.created_at,
      updated_at: g.updated_at,
      // Frontend compatibility
      guest_name: [g.first_name, g.last_name].filter(Boolean).join(" ") || "Unknown Guest",
      room_type: g.room || "",
      guests_count: g.guests != null ? String(g.guests) : "",
      stated_arrival_time: g.arrival_time_stated || "",
    }));

    return NextResponse.json({ guests: transformed });
  } catch (error) {
    console.error("Error fetching guests:", error);
    return NextResponse.json({ guests: [] });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking_id, ...updates } = body;

    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
    }

    const supabaseUpdates: Partial<MasterGuest> = {};
    // Map any incoming fields
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        if (key === "nights" || key === "guests" || key === "adults" || key === "children") {
          (supabaseUpdates as any)[key] = parseInt(String(value)) || null;
        } else if (key === "total_eur" || key === "city_tax") {
          (supabaseUpdates as any)[key] = parseFloat(String(value)) || null;
        } else {
          (supabaseUpdates as any)[key] = String(value);
        }
      }
    }

    const updated = await updateGuestByBookingId(booking_id, supabaseUpdates);

    if (!updated) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, guest: updated });
  } catch (error) {
    console.error("Error updating guest:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const guest = await insertGuest({
      booking_id: body.booking_id || `OPS-${Date.now()}`,
      source: body.source || "manual",
      status: body.status || "confirmed",
      first_name: body.first_name || "",
      last_name: body.last_name || "",
      email: body.email || "",
      phone: body.phone || "",
      country: body.country || "",
      language: body.language || "",
      property: body.property || "",
      room: body.room || "",
      check_in: body.check_in || "",
      check_out: body.check_out || "",
      nights: parseInt(body.nights) || null,
      guests: parseInt(body.guests) || null,
      adults: parseInt(body.adults) || null,
      children: parseInt(body.children) || 0,
      total_eur: parseFloat(body.total_eur) || null,
      special_requests: body.special_requests || "",
      arrival_time_stated: body.arrival_time_stated || "",
    });

    return NextResponse.json({ success: true, guest });
  } catch (error) {
    console.error("Error creating guest:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Create failed" }, { status: 500 });
  }
}
