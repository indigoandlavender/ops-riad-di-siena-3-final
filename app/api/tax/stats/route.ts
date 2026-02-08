import { NextRequest, NextResponse } from "next/server";
import { getAllGuests } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const guests = await getAllGuests();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    // Filter to real bookings
    const bookings = guests.filter(
      (g) => g.source !== "Blocked" && g.source !== "Blackout" && g.status !== "cancelled"
    );

    // Filter by month if specified
    const filtered = month
      ? bookings.filter((b) => b.check_in && b.check_in.startsWith(month))
      : bookings;

    let totalTaxDue = 0;
    let totalTaxCollected = 0;
    let pendingCount = 0;
    let paidCount = 0;
    const taxByMonth: Record<string, { due: number; collected: number; pending: number }> = {};

    for (const b of filtered) {
      if (!b.check_in || !b.nights || !b.guests) continue;

      const taxPerNight = 2.5; // MAD 25 ≈ EUR 2.50
      const taxDue = taxPerNight * b.nights * b.guests;
      totalTaxDue += taxDue;

      const checkIn = new Date(b.check_in);
      const monthKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, "0")}`;

      if (!taxByMonth[monthKey]) {
        taxByMonth[monthKey] = { due: 0, collected: 0, pending: 0 };
      }
      taxByMonth[monthKey].due += taxDue;

      if (b.city_tax_paid && b.city_tax_paid !== "" && b.city_tax_paid !== "pending") {
        totalTaxCollected += taxDue;
        taxByMonth[monthKey].collected += taxDue;
        paidCount++;
      } else {
        taxByMonth[monthKey].pending += taxDue;
        pendingCount++;
      }
    }

    return NextResponse.json({
      totalTaxDue: totalTaxDue.toFixed(2),
      totalTaxCollected: totalTaxCollected.toFixed(2),
      outstanding: (totalTaxDue - totalTaxCollected).toFixed(2),
      paidCount,
      pendingCount,
      taxByMonth,
    });
  } catch (error) {
    console.error("Tax stats error:", error);
    return NextResponse.json({ error: "Failed to fetch tax stats" }, { status: 500 });
  }
}
