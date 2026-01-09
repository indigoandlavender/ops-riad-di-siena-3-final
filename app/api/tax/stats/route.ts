import { NextRequest, NextResponse } from "next/server";
import { getSheetData, rowsToObjects } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData("Master_Guests");
    const allGuests = rowsToObjects<Record<string, string>>(data);

    // Deduplicate by booking_id (keep the last occurrence)
    const guestMap = new Map<string, Record<string, string>>();
    for (const guest of allGuests) {
      if (guest.booking_id) {
        guestMap.set(guest.booking_id, guest);
      }
    }
    const guests = Array.from(guestMap.values());

    // Helper to check if booking is cancelled
    const isCancelled = (status: string) => {
      const s = (status || "").toLowerCase();
      return s === "cancelled" || s === "canceled";
    };

    // Get date from query param or use today
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    
    let targetDate: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = new Date(dateParam + "T00:00:00");
    } else {
      targetDate = new Date();
    }
    const todayStr = targetDate.toISOString().split("T")[0];
    const monthStr = todayStr.substring(0, 7); // YYYY-MM

    // Calculate city tax (only for Booking.com guests)
    const calculateTax = (g: Record<string, string>): number => {
      const ch = (g.source || "").toLowerCase();
      if (!ch.includes("booking")) return 0;
      const nights = parseInt(g.nights || "1", 10);
      const guestCount = parseInt(g.guests || g.adults || "2", 10);
      return 2.5 * nights * guestCount;
    };

    // Filter for check-ins today
    const todayCheckIns = guests.filter((g) => {
      if (!g.check_in) return false;
      const checkInDate = g.check_in.split("T")[0];
      const ch = (g.source || "").toLowerCase();
      return checkInDate === todayStr && !isCancelled(g.status) && ch.includes("booking");
    });

    // Filter for check-ins this month
    const monthCheckIns = guests.filter((g) => {
      if (!g.check_in) return false;
      const checkInDate = g.check_in.split("T")[0];
      const checkInMonth = checkInDate.substring(0, 7);
      const ch = (g.source || "").toLowerCase();
      return checkInMonth === monthStr && !isCancelled(g.status) && ch.includes("booking");
    });

    // Calculate totals
    let dailyTotal = 0;
    let dailyPaid = 0;
    let dailyUnpaid = 0;
    const dailyBookings: Array<{
      booking_id: string;
      guest_name: string;
      tax_amount: number;
      paid: boolean;
      paid_at: string;
    }> = [];

    for (const g of todayCheckIns) {
      const tax = calculateTax(g);
      const isPaid = !!g.city_tax_paid;
      dailyTotal += tax;
      if (isPaid) {
        dailyPaid += tax;
      } else {
        dailyUnpaid += tax;
      }
      dailyBookings.push({
        booking_id: g.booking_id,
        guest_name: [g.first_name, g.last_name].filter(Boolean).join(" ") || "Guest",
        tax_amount: tax,
        paid: isPaid,
        paid_at: g.city_tax_paid || "",
      });
    }

    let monthlyTotal = 0;
    let monthlyPaid = 0;
    let monthlyUnpaid = 0;

    for (const g of monthCheckIns) {
      const tax = calculateTax(g);
      const isPaid = !!g.city_tax_paid;
      monthlyTotal += tax;
      if (isPaid) {
        monthlyPaid += tax;
      } else {
        monthlyUnpaid += tax;
      }
    }

    return NextResponse.json({
      date: todayStr,
      month: monthStr,
      daily: {
        total: dailyTotal,
        paid: dailyPaid,
        unpaid: dailyUnpaid,
        bookings: dailyBookings,
      },
      monthly: {
        total: monthlyTotal,
        paid: monthlyPaid,
        unpaid: monthlyUnpaid,
        bookingCount: monthCheckIns.length,
      },
    });
  } catch (error) {
    console.error("Tax stats API error:", error);
    return NextResponse.json(
      { error: "Could not load tax stats" },
      { status: 500 }
    );
  }
}
