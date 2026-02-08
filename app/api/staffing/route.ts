import { NextResponse } from "next/server";
import { getAllGuests } from "@/lib/supabase";

interface DayInfo {
  date: string;
  dayName: string;
  dayNumber: number;
  isWeekend: boolean;
  checkIns: number;
  checkOuts: number;
  rooms: number;
  guests: string[];
  status: 'day-off' | 'normal' | 'busy' | 'extra-help';
}

interface WeekInfo {
  weekStart: string;
  weekEnd: string;
  days: DayInfo[];
  weekendClear: boolean;
  saturdayClear: boolean;
  sundayClear: boolean;
}

function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weeksParam = searchParams.get("weeks") || "4";
    const weeks = Math.min(parseInt(weeksParam), 8);

    const allGuests = await getAllGuests();

    // Build check-in and check-out maps
    const checkInMap: Map<string, string[]> = new Map();
    const checkOutMap: Map<string, number> = new Map();

    for (const guest of allGuests) {
      if (guest.status === "cancelled") continue;

      const checkIn = guest.check_in?.slice(0, 10);
      const checkOut = guest.check_out?.slice(0, 10);
      const guestName = `${guest.first_name || ""} ${guest.last_name || ""}`.trim();

      if (checkIn) {
        const existing = checkInMap.get(checkIn) || [];
        existing.push(guestName);
        checkInMap.set(checkIn, existing);
      }

      if (checkOut) {
        const count = checkOutMap.get(checkOut) || 0;
        checkOutMap.set(checkOut, count + 1);
      }
    }

    // Generate weeks starting from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToMonday);

    const weeksData: WeekInfo[] = [];

    for (let w = 0; w < weeks; w++) {
      const currentWeekStart = new Date(weekStart);
      currentWeekStart.setDate(weekStart.getDate() + (w * 7));

      const days: DayInfo[] = [];
      let saturdayClear = false;
      let sundayClear = false;

      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentWeekStart.getDate() + d);

        const dateStr = formatDateStr(currentDate);
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
        const isWeekend = d === 5 || d === 6;

        const guests = checkInMap.get(dateStr) || [];
        const checkIns = guests.length;
        const checkOuts = checkOutMap.get(dateStr) || 0;
        const rooms = checkIns + checkOuts;

        let status: DayInfo['status'];
        if (checkIns === 0) {
          status = 'day-off';
          if (d === 5) saturdayClear = true;
          if (d === 6) sundayClear = true;
        } else if (checkIns >= 5) {
          status = 'extra-help';
        } else if (checkIns >= 3) {
          status = 'busy';
        } else {
          status = 'normal';
        }

        days.push({ date: dateStr, dayName, dayNumber: currentDate.getDate(), isWeekend, checkIns, checkOuts, rooms, guests, status });
      }

      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);

      weeksData.push({
        weekStart: formatDateStr(currentWeekStart),
        weekEnd: formatDateStr(weekEnd),
        days,
        weekendClear: saturdayClear || sundayClear,
        saturdayClear,
        sundayClear,
      });
    }

    return NextResponse.json({ weeks: weeksData });
  } catch (error) {
    console.error("Staffing API error:", error);
    return NextResponse.json({ error: "Failed to fetch staffing data" }, { status: 500 });
  }
}
