import { NextRequest, NextResponse } from "next/server";
import { getSheetData, updateSheetRow, rowsToObjects, appendToSheet } from "@/lib/sheets";

// Normalize phone number - ensure it has + prefix and is properly formatted
function normalizePhone(phone: string | number | undefined): string {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  // Remove leading quote if present (Google Sheets text indicator)
  if (cleaned.startsWith("'")) {
    cleaned = cleaned.slice(1);
  }
  // Add + prefix if missing
  if (cleaned && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

// Match the actual Master_Guests sheet columns (29 columns)
const HEADERS = [
  "booking_id",
  "source",
  "status",
  "first_name",
  "last_name",
  "email",
  "phone",
  "country",
  "language",
  "property",
  "room",
  "check_in",
  "check_out",
  "nights",
  "guests",
  "adults",
  "children",
  "total_eur",
  "city_tax",
  "special_requests",
  "arrival_time_stated",
  "arrival_request_sent",
  "arrival_confirmed",
  "arrival_time_confirmed",
  "read_messages",
  "midstay_checkin",
  "notes",
  "created_at",
  "updated_at",
];

interface Guest {
  booking_id: string;
  source: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  language: string;
  property: string;
  room: string;
  check_in: string;
  check_out: string;
  nights: string;
  guests: string;
  adults: string;
  children: string;
  total_eur: string;
  city_tax: string;
  special_requests: string;
  arrival_time_stated: string;
  arrival_request_sent: string;
  arrival_confirmed: string;
  arrival_time_confirmed: string;
  read_messages: string;
  midstay_checkin: string;
  notes: string;
  created_at: string;
  updated_at: string;
  [key: string]: string;
}

export async function GET() {
  try {
    const rows = await getSheetData("Master_Guests");
    const allGuests = rowsToObjects<Guest>(rows);

    // Deduplicate by booking_id (keep last occurrence - most recent)
    const guestMap = new Map<string, Guest>();
    for (const guest of allGuests) {
      if (guest.booking_id) {
        guestMap.set(guest.booking_id, guest);
      }
    }
    const guests = Array.from(guestMap.values());

    // Transform to match frontend interface
    const transformed = guests.map((g) => ({
      ...g,
      // Normalize phone number
      phone: normalizePhone(g.phone),
      // Combine first_name and last_name into guest_name
      guest_name: [g.first_name, g.last_name].filter(Boolean).join(" ") || "Unknown Guest",
      // Map room to room_type for frontend compatibility
      room_type: g.room || "",
      // Map guests to guests_count
      guests_count: g.guests || "",
      // Map arrival fields
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

    // Get current data
    const rows = await getSheetData("Master_Guests");
    const guests = rowsToObjects<Guest>(rows);

    // Find the guest
    const guestIndex = guests.findIndex((g) => g.booking_id === booking_id);
    if (guestIndex === -1) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Merge updates
    const updated = { ...guests[guestIndex], ...updates };
    updated.updated_at = new Date().toISOString();

    // Convert to row array in correct column order
    const rowValues = HEADERS.map((h) => updated[h] || "");

    // Update the sheet
    await updateSheetRow("Master_Guests", guestIndex, rowValues);

    return NextResponse.json({ success: true, guest: updated });
  } catch (error) {
    console.error("Error updating guest:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

// Add new guest (for manual entry)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    
    const guest: Guest = {
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
      nights: body.nights || "",
      guests: body.guests || "",
      adults: body.adults || "",
      children: body.children || "",
      total_eur: body.total_eur || "",
      city_tax: body.city_tax || "",
      special_requests: body.special_requests || "",
      arrival_time_stated: body.arrival_time_stated || "",
      arrival_request_sent: "",
      arrival_confirmed: "",
      arrival_time_confirmed: "",
      read_messages: "",
      midstay_checkin: "",
      notes: body.notes || "",
      created_at: now,
      updated_at: now,
    };

    // Append to sheet
    const rowValues = HEADERS.map((h) => guest[h] || "");
    await appendToSheet("Master_Guests", [rowValues]);

    return NextResponse.json({ success: true, guest });
  } catch (error) {
    console.error("Error creating guest:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Create failed" },
      { status: 500 }
    );
  }
}
