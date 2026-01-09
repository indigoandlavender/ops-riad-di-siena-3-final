import { NextResponse } from "next/server";
import { getSheetData, rowsToObjects } from "@/lib/sheets";

export const dynamic = "force-dynamic";

interface BookingRow {
  check_in: string;
  check_out: string;
  nights: string;
  total_eur: string;
  property: string;
  room: string;
  source: string;
  status: string;
}

interface MonthlyADR {
  month: string;
  adr: number;
  totalRevenue: number;
  totalNights: number;
  bookingCount: number;
}

export async function GET() {
  try {
    const rows = await getSheetData("Master_Guests");
    const bookings = rowsToObjects(rows) as BookingRow[];

    // Group bookings by month (based on check-in date)
    const monthlyData: Record<string, { revenue: number; nights: number; count: number }> = {};

    for (const booking of bookings) {
      // Skip if no check-in date or invalid data
      if (!booking.check_in) continue;
      
      const nights = parseInt(booking.nights) || 0;
      const total = parseFloat(booking.total_eur) || 0;
      
      // Skip if no valid nights or total
      if (nights <= 0 || total <= 0) continue;
      
      // Skip cancelled bookings
      if (booking.status?.toLowerCase() === "cancelled") continue;

      // Extract month from check-in date (format: YYYY-MM-DD or DD/MM/YYYY)
      let monthKey: string;
      if (booking.check_in.includes("-")) {
        // YYYY-MM-DD format
        monthKey = booking.check_in.substring(0, 7); // YYYY-MM
      } else if (booking.check_in.includes("/")) {
        // DD/MM/YYYY format
        const parts = booking.check_in.split("/");
        if (parts.length === 3) {
          monthKey = `${parts[2]}-${parts[1].padStart(2, "0")}`;
        } else {
          continue;
        }
      } else {
        continue;
      }

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, nights: 0, count: 0 };
      }

      monthlyData[monthKey].revenue += total;
      monthlyData[monthKey].nights += nights;
      monthlyData[monthKey].count += 1;
    }

    // Convert to array and calculate ADR
    const monthlyADR: MonthlyADR[] = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        adr: data.nights > 0 ? data.revenue / data.nights : 0,
        totalRevenue: data.revenue,
        totalNights: data.nights,
        bookingCount: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate overall statistics
    const allTime = monthlyADR.reduce(
      (acc, m) => ({
        revenue: acc.revenue + m.totalRevenue,
        nights: acc.nights + m.totalNights,
        count: acc.count + m.bookingCount,
      }),
      { revenue: 0, nights: 0, count: 0 }
    );

    const overallADR = allTime.nights > 0 ? allTime.revenue / allTime.nights : 0;

    // Calculate year-over-year
    const yearlyADR: Record<string, { revenue: number; nights: number }> = {};
    for (const m of monthlyADR) {
      const year = m.month.substring(0, 4);
      if (!yearlyADR[year]) {
        yearlyADR[year] = { revenue: 0, nights: 0 };
      }
      yearlyADR[year].revenue += m.totalRevenue;
      yearlyADR[year].nights += m.totalNights;
    }

    const yearlyStats = Object.entries(yearlyADR)
      .map(([year, data]) => ({
        year,
        adr: data.nights > 0 ? data.revenue / data.nights : 0,
        totalNights: data.nights,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // Calculate trend (last 6 months vs previous 6 months)
    const last12 = monthlyADR.slice(-12);
    const recent6 = last12.slice(-6);
    const previous6 = last12.slice(0, 6);

    const recentADR = recent6.reduce((sum, m) => sum + m.totalRevenue, 0) / 
                      Math.max(recent6.reduce((sum, m) => sum + m.totalNights, 0), 1);
    const previousADR = previous6.reduce((sum, m) => sum + m.totalRevenue, 0) / 
                        Math.max(previous6.reduce((sum, m) => sum + m.totalNights, 0), 1);
    
    const trendPercent = previousADR > 0 ? ((recentADR - previousADR) / previousADR) * 100 : 0;

    return NextResponse.json({
      monthly: monthlyADR,
      yearly: yearlyStats,
      overall: {
        adr: overallADR,
        totalRevenue: allTime.revenue,
        totalNights: allTime.nights,
        bookingCount: allTime.count,
      },
      trend: {
        recent6MonthsADR: recentADR,
        previous6MonthsADR: previousADR,
        percentChange: trendPercent,
      },
    });
  } catch (error) {
    console.error("Failed to calculate ADR:", error);
    return NextResponse.json({ error: "Failed to calculate ADR" }, { status: 500 });
  }
}
