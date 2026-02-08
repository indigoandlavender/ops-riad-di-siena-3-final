import { NextResponse } from "next/server";
import { getGuestByBookingId } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("id");

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  try {
    const guest = await getGuestByBookingId(bookingId);

    if (!guest) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({
      booking: {
        booking_id: guest.booking_id,
        first_name: guest.first_name,
        last_name: guest.last_name,
        check_in: guest.check_in,
        check_out: guest.check_out,
        nights: guest.nights,
        guests: guest.guests,
        total_eur: guest.total_eur,
        city_tax_paid: guest.city_tax_paid,
        property: guest.property,
        room: guest.room,
        source: guest.source,
        status: guest.status,
      },
    });
  } catch (error) {
    console.error("Tax booking error:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}
