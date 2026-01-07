import { NextResponse } from "next/server";
import { getSheetData, rowsToObjects } from "@/lib/sheets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("id");

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking ID" }, { status: 400 });
  }

  try {
    // Get Master_Guests data using shared auth
    const rows = await getSheetData("Master_Guests");
    
    if (rows.length < 2) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const guests = rowsToObjects<Record<string, string>>(rows);
    
    // Find the booking by ID
    const booking = guests.find(g => g.booking_id === bookingId);
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Build guest name
    let guestName = "";
    if (booking.guest_name) {
      guestName = booking.guest_name;
    } else {
      guestName = [booking.first_name, booking.last_name].filter(Boolean).join(" ");
    }

    return NextResponse.json({
      booking: {
        id: booking.booking_id,
        guestName,
        checkIn: booking.check_in?.split("T")[0] || "",
        checkOut: booking.check_out?.split("T")[0] || "",
        room: booking.room || "",
        arrivalTime: booking.arrival_time_confirmed || "",
      },
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}
