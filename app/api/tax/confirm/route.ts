import { NextRequest, NextResponse } from "next/server";
import { updateGuestByBookingId } from "@/lib/supabase";
import { sendPaymentEmails } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { booking_id, payment_method, amount, transaction_id, notes } = await request.json();

    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
    }

    // Build city_tax_paid value
    let cityTaxPaid = "";
    if (payment_method === "paypal" && transaction_id) {
      cityTaxPaid = `PayPal: ${transaction_id}`;
    } else if (payment_method === "cash") {
      cityTaxPaid = `cash: ${amount ? amount + " EUR" : "paid"}`;
    } else {
      cityTaxPaid = new Date().toISOString();
    }
    if (notes) cityTaxPaid += ` - ${notes}`;

    const updated = await updateGuestByBookingId(booking_id, {
      city_tax_paid: cityTaxPaid,
    });

    if (!updated) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Try to send confirmation emails
    try {
      if (updated.email) {
        await sendPaymentEmails({
          bookingId: updated.booking_id,
          guestName: `${updated.first_name} ${updated.last_name}`,
          guestEmail: updated.email,
          amount: amount || "city tax",
          paymentMethod: payment_method,
        });
      }
    } catch (emailErr) {
      console.error("Email send failed (non-blocking):", emailErr);
    }

    return NextResponse.json({ success: true, city_tax_paid: cityTaxPaid });
  } catch (error) {
    console.error("Tax confirm error:", error);
    return NextResponse.json({ error: "Failed to confirm tax payment" }, { status: 500 });
  }
}
