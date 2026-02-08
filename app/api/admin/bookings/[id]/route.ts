import { NextResponse } from "next/server";
import { getGuestByBookingId, updateGuestByBookingId, deleteGuestByBookingId, updateGuestById, deleteGuestById } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    const id = params.id;

    // Try numeric id first, then booking_id
    let result;
    const numId = parseInt(id);
    if (!isNaN(numId) && String(numId) === id) {
      result = await updateGuestById(numId, {
        status: updates.status,
        first_name: updates.firstName || updates.first_name,
        last_name: updates.lastName || updates.last_name,
        email: updates.email,
        phone: updates.phone,
        country: updates.country,
        language: updates.language,
        property: updates.property,
        room: updates.room,
        check_in: updates.checkIn || updates.check_in,
        check_out: updates.checkOut || updates.check_out,
        nights: updates.nights ? parseInt(updates.nights) : undefined,
        guests: updates.guests ? parseInt(updates.guests) : undefined,
        adults: updates.adults ? parseInt(updates.adults) : undefined,
        children: updates.children ? parseInt(updates.children) : undefined,
        total_eur: updates.total ? parseFloat(updates.total) : undefined,
        special_requests: updates.specialRequests || updates.special_requests,
        arrival_time_stated: updates.arrivalTimeStated || updates.arrival_time_stated,
        arrival_confirmed: updates.arrivalConfirmed || updates.arrival_confirmed,
        arrival_time_confirmed: updates.arrivalTimeConfirmed || updates.arrival_time_confirmed,
        city_tax_paid: updates.cityTaxPaid || updates.city_tax_paid,
      });
    } else {
      result = await updateGuestByBookingId(id, {
        status: updates.status,
        first_name: updates.firstName || updates.first_name,
        last_name: updates.lastName || updates.last_name,
        email: updates.email,
        phone: updates.phone,
        room: updates.room,
        property: updates.property,
        check_in: updates.checkIn || updates.check_in,
        check_out: updates.checkOut || updates.check_out,
        nights: updates.nights ? parseInt(updates.nights) : undefined,
        guests: updates.guests ? parseInt(updates.guests) : undefined,
        total_eur: updates.total ? parseFloat(updates.total) : undefined,
        special_requests: updates.specialRequests || updates.special_requests,
        city_tax_paid: updates.cityTaxPaid || updates.city_tax_paid,
      });
    }

    if (!result) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update booking:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const numId = parseInt(id);

    if (!isNaN(numId) && String(numId) === id) {
      await deleteGuestById(numId);
    } else {
      await deleteGuestByBookingId(id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete booking:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
