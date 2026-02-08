import { NextResponse } from "next/server";
import { updateGuestByBookingId } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { booking_id, method, notes } = await request.json();

    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
    }

    let cityTaxPaid = method || new Date().toISOString();
    if (notes) cityTaxPaid += ` - ${notes}`;

    const updated = await updateGuestByBookingId(booking_id, {
      city_tax_paid: cityTaxPaid,
    });

    if (!updated) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark paid error:", error);
    return NextResponse.json({ error: "Failed to mark as paid" }, { status: 500 });
  }
}
