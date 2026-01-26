import { NextResponse } from "next/server";
import { getSheetData, rowsToObjects, appendToSheet } from "@/lib/sheets";

export const dynamic = "force-dynamic";

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

// Normalize date to ISO format (YYYY-MM-DD)
// Handles: "2026-04-19", "4/19/2026", "19/4/2026", serial numbers, Date objects
function normalizeDate(dateValue: any): string {
  if (!dateValue) return "";
  
  // Already ISO format
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    return dateValue.slice(0, 10);
  }
  
  // Serial number (days since Dec 30, 1899)
  if (typeof dateValue === 'number' && dateValue > 40000 && dateValue < 60000) {
    const date = new Date((dateValue - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  
  // String date formats
  if (typeof dateValue === 'string') {
    // Try US format: M/D/YYYY or MM/DD/YYYY
    const usMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try EU format: D/M/YYYY or DD/MM/YYYY
    const euMatch = dateValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try parsing with Date constructor
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  
  // Return as-is if we can't parse
  console.log("[normalizeDate] Could not parse date:", dateValue, typeof dateValue);
  return String(dateValue);
}

export async function GET() {
  try {
    const rows = await getSheetData("Master_Guests");
    const rawBookings = rowsToObjects(rows);
    
    // Map Master_Guests columns to booking format
    const bookings = rawBookings.map((row: any) => ({
      Booking_ID: row.booking_id || "",
      Timestamp: row.created_at || "",
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      email: row.email || "",
      phone: normalizePhone(row.phone),
      country: row.country || "",
      language: row.language || "",
      checkIn: normalizeDate(row.check_in),
      checkOut: normalizeDate(row.check_out),
      nights: row.nights || "",
      guests: row.guests || "",
      adults: row.adults || "",
      children: row.children || "",
      total: row.total_eur || "",
      status: row.status || "",
      room: row.room || "",
      property: row.property || "",
      source: row.source || "",
      specialRequests: row.special_requests || "",
      arrivalTimeStated: row.arrival_time_stated || "",
      arrivalRequestSent: row.arrival_request_sent || "",
      arrivalConfirmed: row.arrival_confirmed || "",
      arrivalTimeConfirmed: row.arrival_time_confirmed || "",
      readMessages: row.read_messages || "",
      midstayCheckin: row.midstay_checkin || "",
      notes: row.notes || "",
      updatedAt: row.updated_at || "",
    }));

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return NextResponse.json({ bookings: [], error: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Master_Guests headers - MUST match exactly the 29 columns in the sheet
    // Column order: booking_id, source, status, first_name, last_name, email, phone, country,
    //               language, property, room, check_in, check_out, nights, guests, adults, children,
    //               total_eur, city_tax, special_requests, arrival_time_stated, arrival_request_sent,
    //               arrival_confirmed, arrival_time_confirmed, read_messages, midstay_checkin,
    //               notes, created_at, updated_at
    
    const row = [
      data.booking_id || `MANUAL-${Date.now()}`,  // 1. booking_id
      data.source || "Direct",                      // 2. source
      data.status || "confirmed",                   // 3. status
      data.first_name || data.firstName || "",      // 4. first_name
      data.last_name || data.lastName || "",        // 5. last_name
      data.email || "",                             // 6. email
      data.phone || "",                             // 7. phone
      data.country || "",                           // 8. country
      data.language || "",                          // 9. language
      data.property || "The Riad",                  // 10. property
      data.room || "",                              // 11. room
      data.check_in || data.checkIn || "",          // 12. check_in
      data.check_out || data.checkOut || "",        // 13. check_out
      data.nights || "",                            // 14. nights
      data.guests || "2",                           // 15. guests
      data.adults || "2",                           // 16. adults
      data.children || "0",                         // 17. children
      data.total_eur || data.total || "",           // 18. total_eur
      "",                                           // 19. city_tax
      data.special_requests || data.specialRequests || "", // 20. special_requests
      data.arrival_time_stated || "",               // 21. arrival_time_stated
      "",                                           // 22. arrival_request_sent
      "pending",                                    // 23. arrival_confirmed
      "",                                           // 24. arrival_time_confirmed
      "",                                           // 25. read_messages
      "pending",                                    // 26. midstay_checkin
      data.notes || "",                             // 27. notes
      new Date().toISOString(),                     // 28. created_at
      "",                                           // 29. updated_at
    ];

    await appendToSheet("Master_Guests", [row]);

    return NextResponse.json({ success: true, booking_id: row[0] });
  } catch (error) {
    console.error("Failed to add booking:", error);
    return NextResponse.json({ error: "Failed to add booking" }, { status: 500 });
  }
}
