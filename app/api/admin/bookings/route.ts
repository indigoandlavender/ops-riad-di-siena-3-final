import { NextResponse } from "next/server";
import { getAllGuests, insertGuest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function normalizePhone(phone: string | number | undefined): string {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  if (cleaned.startsWith("'")) cleaned = cleaned.slice(1);
  if (cleaned && !cleaned.startsWith("+")) cleaned = "+" + cleaned;
  return cleaned;
}

function normalizeDate(dateValue: any): string {
  if (!dateValue) return "";
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) return dateValue.slice(0, 10);
  if (typeof dateValue === "number" && dateValue > 40000 && dateValue < 60000) {
    return new Date((dateValue - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  if (typeof dateValue === "string") {
    const usMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return String(dateValue);
}

export async function GET() {
  try {
    const guests = await getAllGuests();
    const bookings = guests.map((row) => ({
      id: row.id,
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
      nights: row.nights != null ? String(row.nights) : "",
      guests: row.guests != null ? String(row.guests) : "",
      adults: row.adults != null ? String(row.adults) : "",
      children: row.children != null ? String(row.children) : "",
      total: row.total_eur != null ? String(row.total_eur) : "",
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
      cityTaxPaid: row.city_tax_paid || "",
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
    const guest = await insertGuest({
      booking_id: data.booking_id || `MANUAL-${Date.now()}`,
      source: data.source || "Direct",
      status: data.status || "confirmed",
      first_name: data.first_name || data.firstName || "",
      last_name: data.last_name || data.lastName || "",
      email: data.email || "",
      phone: data.phone || "",
      country: data.country || "",
      language: data.language || "",
      property: data.property || "The Riad",
      room: data.room || "",
      check_in: data.check_in || data.checkIn || "",
      check_out: data.check_out || data.checkOut || "",
      nights: parseInt(data.nights) || null,
      guests: parseInt(data.guests) || 2,
      adults: parseInt(data.adults) || 2,
      children: parseInt(data.children) || 0,
      total_eur: parseFloat(data.total_eur || data.total) || null,
      special_requests: data.special_requests || data.specialRequests || "",
      arrival_time_stated: data.arrival_time_stated || "",
      arrival_confirmed: "pending",
      midstay_checkin: "pending",
    });
    return NextResponse.json({ success: true, booking_id: guest.booking_id, id: guest.id });
  } catch (error) {
    console.error("Failed to add booking:", error);
    return NextResponse.json({ error: "Failed to add booking" }, { status: 500 });
  }
}
