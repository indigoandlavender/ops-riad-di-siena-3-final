import { NextRequest, NextResponse } from "next/server";
import { updateGuestByBookingId } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { bookingId, notes } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    // Update the notes column
    const updated = await updateGuestByBookingId(bookingId, {
      // @ts-ignore - notes column added via ALTER TABLE
      notes: notes || "",
    } as any);

    if (!updated) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save notes error:", error);
    return NextResponse.json({ error: "Failed to save notes" }, { status: 500 });
  }
}
