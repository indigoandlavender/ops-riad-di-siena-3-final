import { NextResponse } from "next/server";
import { getSheetData, rowsToObjects } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Commission rates by source (as percentages)
const COMMISSION_RATES: Record<string, number> = {
  "Booking.com": 15,
  "booking.com": 15,
  "Airbnb": 3,
  "airbnb": 3,
  "Direct": 0,
  "direct": 0,
  "Website": 0,
  "website": 0,
  "WhatsApp": 0,
  "whatsapp": 0,
};

function getCommissionRate(source: string): number {
  // Try exact match first
  if (COMMISSION_RATES[source] !== undefined) {
    return COMMISSION_RATES[source];
  }
  // Try lowercase
  const lower = source.toLowerCase();
  if (COMMISSION_RATES[lower] !== undefined) {
    return COMMISSION_RATES[lower];
  }
  // Check if contains known sources
  if (lower.includes("booking")) return 15;
  if (lower.includes("airbnb")) return 3;
  // Default to 0 for unknown sources
  return 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // Format: YYYY-MM
    
    // Default to current month
    const now = new Date();
    const targetMonth = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [year, month] = targetMonth.split("-").map(Number);
    
    const rows = await getSheetData("Master_Guests");
    const bookings = rowsToObjects(rows);
    
    // Filter bookings for the target month (by check-in date)
    const monthlyBookings = bookings.filter((booking: any) => {
      const checkIn = booking.check_in;
      if (!checkIn) return false;
      const checkInDate = new Date(checkIn);
      return checkInDate.getFullYear() === year && checkInDate.getMonth() + 1 === month;
    });
    
    // Calculate revenue by source
    const bySource: Record<string, { gross: number; commission: number; net: number; count: number }> = {};
    let totalGross = 0;
    let totalCommission = 0;
    let totalNet = 0;
    let totalAirbnbNet = 0; // Track Airbnb net for Kathleen's share
    
    monthlyBookings.forEach((booking: any) => {
      const source = booking.source || "Unknown";
      const gross = parseFloat(booking.total_eur) || 0;
      const commissionRate = getCommissionRate(source);
      const commission = gross * (commissionRate / 100);
      const net = gross - commission;
      
      if (!bySource[source]) {
        bySource[source] = { gross: 0, commission: 0, net: 0, count: 0 };
      }
      
      bySource[source].gross += gross;
      bySource[source].commission += commission;
      bySource[source].net += net;
      bySource[source].count += 1;
      
      totalGross += gross;
      totalCommission += commission;
      totalNet += net;
      
      // Track Airbnb revenue for Kathleen's 40% share
      if (source.toLowerCase().includes("airbnb")) {
        totalAirbnbNet += net;
      }
    });
    
    // Kathleen gets 40% of Airbnb net revenue
    const kathleenShare = totalAirbnbNet * 0.4;
    const jacquelineNet = totalNet - kathleenShare;
    
    // Get previous months for comparison (last 6 months)
    const monthlyHistory: Array<{
      month: string;
      label: string;
      gross: number;
      commission: number;
      net: number;
      bookingCount: number;
    }> = [];
    
    for (let i = 0; i < 6; i++) {
      const histDate = new Date(year, month - 1 - i, 1);
      const histYear = histDate.getFullYear();
      const histMonth = histDate.getMonth() + 1;
      const histKey = `${histYear}-${String(histMonth).padStart(2, "0")}`;
      
      const histBookings = bookings.filter((booking: any) => {
        const checkIn = booking.check_in;
        if (!checkIn) return false;
        const checkInDate = new Date(checkIn);
        return checkInDate.getFullYear() === histYear && checkInDate.getMonth() + 1 === histMonth;
      });
      
      let histGross = 0;
      let histCommission = 0;
      
      histBookings.forEach((booking: any) => {
        const source = booking.source || "Unknown";
        const gross = parseFloat(booking.total_eur) || 0;
        const commissionRate = getCommissionRate(source);
        histGross += gross;
        histCommission += gross * (commissionRate / 100);
      });
      
      monthlyHistory.push({
        month: histKey,
        label: histDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        gross: histGross,
        commission: histCommission,
        net: histGross - histCommission,
        bookingCount: histBookings.length,
      });
    }
    
    return NextResponse.json({
      month: targetMonth,
      monthLabel: new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      totals: {
        gross: totalGross,
        commission: totalCommission,
        net: totalNet,
        airbnbNet: totalAirbnbNet,
        kathleenShare: kathleenShare,
        jacquelineNet: jacquelineNet,
        bookingCount: monthlyBookings.length,
      },
      bySource: Object.entries(bySource).map(([source, data]) => ({
        source,
        ...data,
        commissionRate: getCommissionRate(source),
      })),
      history: monthlyHistory,
      commissionRates: {
        "Booking.com": 15,
        "Airbnb": 3,
        "Direct": 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch revenue stats:", error);
    return NextResponse.json({ error: "Failed to fetch revenue stats" }, { status: 500 });
  }
}
