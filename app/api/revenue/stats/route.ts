import { NextResponse } from "next/server";
import { getAllGuests } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const guests = await getAllGuests();

    // Filter to real bookings (not blocked/blackout)
    const bookings = guests.filter(
      (g) => g.source !== "Blocked" && g.source !== "Blackout" && g.status !== "cancelled"
    );

    // Current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Revenue by month
    const monthlyRevenue: Record<string, number> = {};
    const monthlyNights: Record<string, number> = {};
    const monthlyBookings: Record<string, number> = {};

    for (const b of bookings) {
      if (!b.check_in || !b.total_eur) continue;
      const checkIn = new Date(b.check_in);
      const key = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(b.total_eur);
      monthlyNights[key] = (monthlyNights[key] || 0) + (b.nights || 0);
      monthlyBookings[key] = (monthlyBookings[key] || 0) + 1;
    }

    // Current month stats
    const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const currentMonthRevenue = monthlyRevenue[currentKey] || 0;
    const currentMonthNights = monthlyNights[currentKey] || 0;
    const currentMonthBookings = monthlyBookings[currentKey] || 0;

    // Total revenue
    const totalRevenue = Object.values(monthlyRevenue).reduce((a, b) => a + b, 0);

    // ADR (Average Daily Rate)
    const totalNights = Object.values(monthlyNights).reduce((a, b) => a + b, 0);
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

    // Revenue by property
    const byProperty: Record<string, number> = {};
    for (const b of bookings) {
      if (!b.total_eur) continue;
      const prop = b.property || "Unknown";
      byProperty[prop] = (byProperty[prop] || 0) + Number(b.total_eur);
    }

    // Revenue by source
    const bySource: Record<string, number> = {};
    for (const b of bookings) {
      if (!b.total_eur) continue;
      const src = b.source || "Unknown";
      bySource[src] = (bySource[src] || 0) + Number(b.total_eur);
    }

    return NextResponse.json({
      totalRevenue: totalRevenue.toFixed(2),
      currentMonthRevenue: currentMonthRevenue.toFixed(2),
      currentMonthNights,
      currentMonthBookings,
      adr: adr.toFixed(2),
      totalBookings: bookings.length,
      totalNights,
      monthlyRevenue,
      monthlyNights,
      monthlyBookings,
      byProperty,
      bySource,
    });
  } catch (error) {
    console.error("Revenue stats error:", error);
    return NextResponse.json({ error: "Failed to fetch revenue stats" }, { status: 500 });
  }
}
