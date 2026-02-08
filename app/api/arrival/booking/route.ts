import { NextResponse } from "next/server";
import { getGuestByBookingId } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("id");

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking ID" }, { status: 400 });
  }

  try {
    const guest = await getGuestByBookingId(bookingId);

    if (!guest) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(" ");

    return NextResponse.json({
      booking: {
        id: guest.booking_id,
        guestName,
        checkIn: guest.check_in?.split("T")[0] || "",
        checkOut: guest.check_out?.split("T")[0] || "",
        room: guest.room || "",
        arrivalTime: guest.arrival_time_confirmed || "",
      },
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}
