import { NextResponse } from "next/server";
import { getAllGuests } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const guests = await getAllGuests();

    const bookings = guests.filter(
      (g) => g.source !== "Blocked" && g.source !== "Blackout" && g.status !== "cancelled" && g.total_eur && g.nights
    );

    // ADR by month
    const adrByMonth: Record<string, { revenue: number; nights: number; adr: number }> = {};
    // ADR by room
    const adrByRoom: Record<string, { revenue: number; nights: number; adr: number }> = {};
    // ADR by source
    const adrBySource: Record<string, { revenue: number; nights: number; adr: number }> = {};

    for (const b of bookings) {
      const revenue = Number(b.total_eur);
      const nights = Number(b.nights);
      if (!revenue || !nights) continue;

      // By month
      const checkIn = new Date(b.check_in);
      const monthKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, "0")}`;
      if (!adrByMonth[monthKey]) adrByMonth[monthKey] = { revenue: 0, nights: 0, adr: 0 };
      adrByMonth[monthKey].revenue += revenue;
      adrByMonth[monthKey].nights += nights;

      // By room
      const room = b.room || "Unknown";
      if (!adrByRoom[room]) adrByRoom[room] = { revenue: 0, nights: 0, adr: 0 };
      adrByRoom[room].revenue += revenue;
      adrByRoom[room].nights += nights;

      // By source
      const source = b.source || "Unknown";
      if (!adrBySource[source]) adrBySource[source] = { revenue: 0, nights: 0, adr: 0 };
      adrBySource[source].revenue += revenue;
      adrBySource[source].nights += nights;
    }

    // Calculate ADRs
    for (const data of Object.values(adrByMonth)) data.adr = data.nights > 0 ? data.revenue / data.nights : 0;
    for (const data of Object.values(adrByRoom)) data.adr = data.nights > 0 ? data.revenue / data.nights : 0;
    for (const data of Object.values(adrBySource)) data.adr = data.nights > 0 ? data.revenue / data.nights : 0;

    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.total_eur), 0);
    const totalNights = bookings.reduce((sum, b) => sum + Number(b.nights), 0);
    const overallAdr = totalNights > 0 ? totalRevenue / totalNights : 0;

    return NextResponse.json({
      overallAdr: overallAdr.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      totalNights,
      adrByMonth,
      adrByRoom,
      adrBySource,
    });
  } catch (error) {
    console.error("ADR insights error:", error);
    return NextResponse.json({ error: "Failed to fetch ADR insights" }, { status: 500 });
  }
}
