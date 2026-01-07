import { NextResponse } from "next/server";
import { google } from "googleapis";

const OPS_SPREADSHEET_ID = process.env.OPS_SPREADSHEET_ID;

async function getGoogleSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

interface DayInfo {
  date: string;           // YYYY-MM-DD
  dayName: string;        // Monday, Tuesday, etc.
  dayNumber: number;      // 1-31
  isWeekend: boolean;
  checkIns: number;
  checkOuts: number;
  rooms: number;          // Rooms that need cleaning (check-outs + stay-overs with check-ins)
  guests: string[];       // Names checking in
  status: 'day-off' | 'normal' | 'busy' | 'extra-help';
}

interface WeekInfo {
  weekStart: string;
  weekEnd: string;
  days: DayInfo[];
  weekendClear: boolean;  // Can someone take weekend off?
  saturdayClear: boolean;
  sundayClear: boolean;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weeksParam = searchParams.get("weeks") || "4";
    const weeks = Math.min(parseInt(weeksParam), 8); // Max 8 weeks
    
    const sheets = await getGoogleSheets();
    
    // Fetch all guests
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: OPS_SPREADSHEET_ID,
      range: "Master_Guests!A:AC",
    });
    
    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ weeks: [] });
    }
    
    const headers = rows[0];
    const checkInIdx = headers.indexOf("check_in");
    const checkOutIdx = headers.indexOf("check_out");
    const firstNameIdx = headers.indexOf("first_name");
    const lastNameIdx = headers.indexOf("last_name");
    const statusIdx = headers.indexOf("status");
    const roomIdx = headers.indexOf("room");
    
    // Build check-in and check-out maps
    const checkInMap: Map<string, string[]> = new Map();
    const checkOutMap: Map<string, number> = new Map();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = row[statusIdx]?.toLowerCase() || "";
      
      // Skip cancelled bookings
      if (status === "cancelled" || status === "canceled") continue;
      
      const checkIn = row[checkInIdx];
      const checkOut = row[checkOutIdx];
      const firstName = row[firstNameIdx] || "";
      const lastName = row[lastNameIdx] || "";
      const guestName = `${firstName} ${lastName}`.trim();
      
      if (checkIn) {
        // Normalize date format
        const normalizedCheckIn = normalizeDate(checkIn);
        if (normalizedCheckIn) {
          const existing = checkInMap.get(normalizedCheckIn) || [];
          existing.push(guestName);
          checkInMap.set(normalizedCheckIn, existing);
        }
      }
      
      if (checkOut) {
        const normalizedCheckOut = normalizeDate(checkOut);
        if (normalizedCheckOut) {
          const count = checkOutMap.get(normalizedCheckOut) || 0;
          checkOutMap.set(normalizedCheckOut, count + 1);
        }
      }
    }
    
    // Generate weeks starting from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find the start of current week (Monday)
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
        
        const dateStr = formatDate(currentDate);
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
        const isWeekend = d === 5 || d === 6; // Saturday or Sunday
        
        const guests = checkInMap.get(dateStr) || [];
        const checkIns = guests.length;
        const checkOuts = checkOutMap.get(dateStr) || 0;
        
        // Rooms needing cleaning = check-outs (turnover) + check-ins on same day (fresh prep)
        // Simplified: just count check-ins as the main work driver
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
        
        days.push({
          date: dateStr,
          dayName,
          dayNumber: currentDate.getDate(),
          isWeekend,
          checkIns,
          checkOuts,
          rooms,
          guests,
          status,
        });
      }
      
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);
      
      weeksData.push({
        weekStart: formatDate(currentWeekStart),
        weekEnd: formatDate(weekEnd),
        days,
        weekendClear: saturdayClear || sundayClear,
        saturdayClear,
        sundayClear,
      });
    }
    
    return NextResponse.json({ weeks: weeksData });
    
  } catch (error) {
    console.error("Staffing API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch staffing data" },
      { status: 500 }
    );
  }
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try different formats
  const str = String(dateStr).trim();
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // DD/MM/YYYY or DD-MM-YYYY
  const euroMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (euroMatch) {
    const day = euroMatch[1].padStart(2, '0');
    const month = euroMatch[2].padStart(2, '0');
    const year = euroMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // MM/DD/YYYY
  const usMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usMatch) {
    // Ambiguous - assume DD/MM/YYYY for European context
    const day = usMatch[1].padStart(2, '0');
    const month = usMatch[2].padStart(2, '0');
    const year = usMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Try parsing as date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }
  
  return null;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
