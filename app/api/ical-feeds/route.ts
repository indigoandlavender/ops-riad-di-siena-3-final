import { NextResponse } from "next/server";
import { getSheetData, rowsToObjects } from "@/lib/sheets";

export const revalidate = 0;
export const dynamic = "force-dynamic";

interface Room {
  room_id: string;
  name: string;
  ical_url: string;
  [key: string]: string;
}

interface BookedRange {
  start: string;
  end: string;
  summary?: string;
}

interface RoomAvailability {
  roomId: string;
  roomName: string;
  property: string;
  icalUrl: string | null;
  blockedDates: BookedRange[];
  error?: string;
}

async function fetchIcalData(url: string): Promise<{ bookedDates: BookedRange[]; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/calendar, text/plain, */*",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { bookedDates: [], error: `HTTP ${response.status}` };
    }

    const icalData = await response.text();
    
    if (!icalData.includes("BEGIN:VCALENDAR")) {
      return { bookedDates: [], error: "Invalid iCal format" };
    }

    // Parse iCal data
    const bookedDates: BookedRange[] = [];
    const lines = icalData.split(/\r?\n/);
    let inEvent = false;
    let startDate = "";
    let endDate = "";
    let summary = "";

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      while (i + 1 < lines.length && (lines[i + 1].startsWith(" ") || lines[i + 1].startsWith("\t"))) {
        i++;
        line += lines[i].trim();
      }
      
      if (line === "BEGIN:VEVENT") {
        inEvent = true;
        startDate = "";
        endDate = "";
        summary = "";
      } else if (line === "END:VEVENT") {
        if (startDate) {
          if (!endDate) {
            const start = new Date(startDate);
            start.setDate(start.getDate() + 1);
            endDate = start.toISOString().split("T")[0];
          }
          bookedDates.push({ start: startDate, end: endDate, summary });
        }
        inEvent = false;
      } else if (inEvent) {
        if (line.startsWith("DTSTART")) {
          const match = line.match(/(\d{4})(\d{2})(\d{2})/);
          if (match) {
            startDate = `${match[1]}-${match[2]}-${match[3]}`;
          }
        } else if (line.startsWith("DTEND")) {
          const match = line.match(/(\d{4})(\d{2})(\d{2})/);
          if (match) {
            endDate = `${match[1]}-${match[2]}-${match[3]}`;
          }
        } else if (line.startsWith("SUMMARY")) {
          summary = line.replace(/^SUMMARY:?/, "").trim();
        }
      }
    }

    return { bookedDates };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { bookedDates: [], error: message };
  }
}

export async function GET() {
  try {
    // Fetch rooms from both properties - may not exist yet
    let riadRooms: Room[] = [];
    let douariaRooms: Room[] = [];
    
    try {
      const riadRows = await getSheetData("Rooms");
      riadRooms = rowsToObjects<Room>(riadRows);
    } catch {
      // Rooms tab doesn't exist yet
    }
    
    try {
      const douariaRows = await getSheetData("Douaria_Rooms");
      douariaRooms = rowsToObjects<Room>(douariaRows);
    } catch {
      // Douaria_Rooms tab doesn't exist yet
    }

    // Build list of rooms with iCal URLs
    const roomsWithIcal: { room: Room; property: string }[] = [];
    
    for (const room of riadRooms) {
      if (room.ical_url) {
        roomsWithIcal.push({ room, property: "riad" });
      }
    }
    
    for (const room of douariaRooms) {
      if (room.ical_url) {
        roomsWithIcal.push({ room, property: "douaria" });
      }
    }

    // Fetch iCal data for each room in parallel
    const results: RoomAvailability[] = await Promise.all(
      roomsWithIcal.map(async ({ room, property }) => {
        const { bookedDates, error } = await fetchIcalData(room.ical_url!);
        return {
          roomId: room.room_id,
          roomName: room.name,
          property,
          icalUrl: room.ical_url || null,
          blockedDates: bookedDates,
          error,
        };
      })
    );

    // Also include rooms without iCal URLs (for completeness)
    const allResults: RoomAvailability[] = [...results];
    
    for (const room of riadRooms) {
      if (!room.ical_url) {
        allResults.push({
          roomId: room.room_id,
          roomName: room.name,
          property: "riad",
          icalUrl: null,
          blockedDates: [],
        });
      }
    }
    
    for (const room of douariaRooms) {
      if (!room.ical_url) {
        allResults.push({
          roomId: room.room_id,
          roomName: room.name,
          property: "douaria",
          icalUrl: null,
          blockedDates: [],
        });
      }
    }

    return NextResponse.json({
      success: true,
      rooms: allResults,
      totalRooms: allResults.length,
      roomsWithIcal: roomsWithIcal.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching iCal feeds:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      rooms: [],
    }, { status: 500 });
  }
}
