import { NextRequest, NextResponse } from "next/server";
import { updateGuestByBookingId } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { bookingId, arrivalTime } = await request.json();

    if (!bookingId || !arrivalTime) {
      return NextResponse.json({ error: "Missing booking ID or arrival time" }, { status: 400 });
    }

    const updated = await updateGuestByBookingId(bookingId, {
      arrival_time_confirmed: arrivalTime,
    });

    if (!updated) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Arrival submit error:", error);
    return NextResponse.json({ error: "Failed to save arrival time" }, { status: 500 });
  }
}
