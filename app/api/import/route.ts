import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  getSheetData,
  appendToSheet,
  updateSheetRow,
  ensureTabExists,
  rowsToObjects,
  objectToRow,
} from "@/lib/sheets";

// Master_Guests column headers (29 columns) - matches actual Google Sheet structure
const HEADERS = [
  "booking_id",
  "source",
  "status",
  "first_name",
  "last_name",
  "email",
  "phone",
  "country",
  "language",
  "property",
  "room",
  "check_in",
  "check_out",
  "nights",
  "guests",
  "adults",
  "children",
  "total_eur",
  "city_tax",
  "special_requests",
  "arrival_time_stated",
  "arrival_request_sent",
  "arrival_confirmed",
  "arrival_time_confirmed",
  "read_messages",
  "midstay_checkin",
  "notes",
  "created_at",
  "updated_at",
];

// Booking.com column mapping - ACTUAL column names from their export
const BOOKING_COM_MAP: Record<string, string> = {
  "Book Number": "booking_id",
  "Check-in": "check_in",
  "Check-out": "check_out",
  "Duration (nights)": "nights",
  "Status": "status",
  "People": "guests",
  "Adults": "adults",
  "Children": "children",
  "Remarks": "special_requests",
};

// Airbnb CSV column mapping - multiple variations
const AIRBNB_MAP: Record<string, string> = {
  // Booking ID
  "Confirmation code": "booking_id",
  "Confirmation Code": "booking_id",
  "confirmation_code": "booking_id",
  
  // Guest name
  "Guest": "guest_name_raw",
  "Guest name": "guest_name_raw",
  "Guest Name": "guest_name_raw",
  
  // Contact
  "Contact": "phone",
  "Phone": "phone",
  "Phone number": "phone",
  
  // Email
  "Email": "email",
  "Guest email": "email",
  
  // Dates
  "Start date": "check_in",
  "Start Date": "check_in",
  "Check-in": "check_in",
  "Checkin": "check_in",
  "End date": "check_out",
  "End Date": "check_out",
  "Check-out": "check_out",
  "Checkout": "check_out",
  
  // Nights
  "# of nights": "nights",
  "Nights": "nights",
  
  // Guests
  "# of adults": "adults",
  "Adults": "adults",
  "# of children": "children",
  "Children": "children",
  "# of guests": "guests",
  "Guests": "guests",
  
  // Property
  "Listing": "property",
  "Listing name": "property",
  
  // Money
  "Earnings": "total_eur",
  "Total payout": "total_eur",
  "Payout": "total_eur",
  "Guest paid": "total_eur",
  
  // Status
  "Status": "status",
  "Reservation status": "status",
};

function detectSource(headers: string[]): "booking.com" | "airbnb" | "unknown" {
  const headerStr = headers.join(" ").toLowerCase();
  
  // Check for Booking.com specific headers (case-insensitive)
  if (headerStr.includes("book number") || headerStr.includes("unit type") || headerStr.includes("booker country") || headerStr.includes("booked by")) {
    return "booking.com";
  }
  // Check for Airbnb specific headers - multiple variations
  if (
    headerStr.includes("confirmation code") || 
    headerStr.includes("confirmation_code") ||
    headerStr.includes("listing") ||
    headerStr.includes("start date") ||
    headerStr.includes("payout") ||
    headerStr.includes("earnings")
  ) {
    return "airbnb";
  }
  return "unknown";
}

function parseCSV(text: string): { headers: string[], rows: Record<string, string>[] } {
  // Try to detect delimiter (semicolon for Booking.com, comma for Airbnb)
  const firstLine = text.split("\n")[0];
  const delimiter = firstLine.includes(";") ? ";" : ",";
  
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse headers - handle quoted values
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  
  const rows = lines.slice(1).map((line) => {
    const values = parseRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });

  return { headers, rows };
}

function parseExcelFile(buffer: ArrayBuffer): { headers: string[], rows: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    raw: false,
    defval: "",
  });
  
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  return { headers, rows: data };
}

function extractArrivalTime(remarks: string): string {
  if (!remarks) return "";
  
  const patterns = [
    /arrival[:\s]*(\d{1,2}[:\s]?\d{0,2}\s*(?:am|pm)?)/i,
    /arrive[:\s]*(\d{1,2}[:\s]?\d{0,2}\s*(?:am|pm)?)/i,
    /eta[:\s]*(\d{1,2}[:\s]?\d{0,2}\s*(?:am|pm)?)/i,
    /(\d{1,2}:\d{2})\s*(?:arrival|arrive)?/i,
    /around\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    /approximately\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  ];

  for (const pattern of patterns) {
    const match = remarks.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return "";
}

function formatPhone(phone: string | number | undefined): string {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  // Wrap in single quote to force text format in Google Sheets
  return "'" + cleaned;
}

function formatCountryCode(code: string): string {
  if (!code) return "";
  // Convert 2-letter country codes to full names (common ones)
  const countryMap: Record<string, string> = {
    "es": "Spain",
    "fr": "France",
    "gb": "United Kingdom",
    "uk": "United Kingdom",
    "us": "United States",
    "de": "Germany",
    "it": "Italy",
    "nl": "Netherlands",
    "be": "Belgium",
    "pt": "Portugal",
    "ch": "Switzerland",
    "at": "Austria",
    "au": "Australia",
    "ca": "Canada",
    "cn": "China",
    "jp": "Japan",
    "kr": "South Korea",
    "ma": "Morocco",
    "ae": "UAE",
    "sa": "Saudi Arabia",
    "br": "Brazil",
    "mx": "Mexico",
    "ar": "Argentina",
    "se": "Sweden",
    "no": "Norway",
    "dk": "Denmark",
    "fi": "Finland",
    "pl": "Poland",
    "ru": "Russia",
    "in": "India",
    "gr": "Greece",
    "ie": "Ireland",
    "nz": "New Zealand",
    "za": "South Africa",
    "sg": "Singapore",
    "hk": "Hong Kong",
    "il": "Israel",
    "tr": "Turkey",
  };
  
  const lower = code.toLowerCase().trim();
  return countryMap[lower] || code.toUpperCase();
}

// Canonical room names for the ops dashboard
// Maps various source names to standardized names
const ROOM_MAPPINGS: { pattern: RegExp; room: string; property: string }[] = [
  // The Riad rooms
  { pattern: /hidden\s*gem/i, room: "Hidden Gem", property: "The Riad" },
  { pattern: /tresor|trésor/i, room: "Trésor Caché", property: "The Riad" },
  { pattern: /jewel\s*box/i, room: "Jewel Box", property: "The Riad" },
  { pattern: /double\s*room/i, room: "Jewel Box", property: "The Riad" }, // Booking.com name for Jewel Box
  
  // The Douaria rooms (Booking.com calls it "The Annex")
  { pattern: /\blove\b/i, room: "Love", property: "The Douaria" },
  { pattern: /\bjoy\b/i, room: "Joy", property: "The Douaria" },
  { pattern: /\bbliss\b/i, room: "Bliss", property: "The Douaria" },
  
  // Other properties
  { pattern: /kasbah/i, room: "", property: "The Kasbah" },
  { pattern: /desert|camp/i, room: "", property: "Desert Camp" },
];

function mapUnitToPropertyAndRoom(unit: string): { property: string; room: string } {
  if (!unit) return { property: "The Riad", room: "" };
  
  // Check for multi-room bookings (comma-separated)
  // e.g., "Joy @ The Annex, Bliss @ The Annex"
  const rooms: string[] = [];
  let property = "";
  
  // Split by comma for multi-room bookings
  const parts = unit.split(",").map(p => p.trim());
  
  for (const part of parts) {
    for (const mapping of ROOM_MAPPINGS) {
      if (mapping.pattern.test(part)) {
        if (mapping.room) {
          rooms.push(mapping.room);
        }
        if (!property && mapping.property) {
          property = mapping.property;
        }
        break;
      }
    }
  }
  
  // If we found rooms, join them; otherwise use the original
  const roomName = rooms.length > 0 ? rooms.join(" / ") : "";
  
  // Default property based on keywords if not found
  if (!property) {
    const lower = unit.toLowerCase();
    if (lower.includes("annex") || lower.includes("douaria")) {
      property = "The Douaria";
    } else if (lower.includes("medina") || lower.includes("riad")) {
      property = "The Riad";
    } else {
      property = "The Riad";
    }
  }
  
  return { property, room: roomName };
}

// Legacy function for backward compatibility
function mapUnitToProperty(unit: string): string {
  return mapUnitToPropertyAndRoom(unit).property;
}

function extractRoomFromUnit(unit: string): string {
  return mapUnitToPropertyAndRoom(unit).room;
}

function parsePrice(price: string): string {
  if (!price) return "";
  // Remove currency symbols and text: "52.12 EUR" → "52.12"
  return price.replace(/[^\d.,]/g, "").replace(",", ".");
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  // Booking.com format: "2026-01-06" - already correct
  // Try to parse and format consistently
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0]; // YYYY-MM-DD
    }
  } catch {
    // Return as-is if parsing fails
  }
  return dateStr;
}

function normalizeStatus(status: string): string {
  if (!status) return "confirmed";
  const lower = status.toLowerCase().trim();
  
  if (lower === "ok" || lower === "confirmed" || lower === "accepted") {
    return "confirmed";
  }
  if (lower.includes("cancel")) {
    return "cancelled";
  }
  if (lower.includes("no show") || lower.includes("noshow")) {
    return "no_show";
  }
  return lower;
}

function transformBookingComRow(row: Record<string, string>): Record<string, string> {
  const transformed: Record<string, string> = {};
  
  // Initialize all fields
  HEADERS.forEach((h) => {
    transformed[h] = "";
  });

  // Map basic fields - handle case variations in Booking.com exports
  transformed.booking_id = String(row["Book number"] || row["Book Number"] || "");
  transformed.check_in = formatDate(row["Check-in"] || "");
  transformed.check_out = formatDate(row["Check-out"] || "");
  transformed.nights = row["Duration (nights)"] || "";
  transformed.status = normalizeStatus(row["Status"] || "");
  transformed.guests = row["Persons"] || row["People"] || "";
  transformed.adults = row["Adults"] || "";
  transformed.children = row["Children"] || "0";
  transformed.special_requests = row["Remarks"] || "";

  // Split guest name into first and last
  // Booking.com format: "LINLONG LU" or "LU, LINLONG"
  const guestName = row["Guest name(s)"] || row["Guest Name(s)"] || row["Booked by"] || "";
  let firstName = "";
  let lastName = "";
  
  if (guestName.includes(",")) {
    // Format: "LU, LINLONG"
    const parts = guestName.split(",").map(p => p.trim());
    lastName = parts[0] || "";
    firstName = parts[1] || "";
  } else {
    // Format: "LINLONG LU"
    const parts = guestName.trim().split(/\s+/);
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ") || "";
  }
  
  // Title case the names
  transformed.first_name = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  transformed.last_name = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();

  // Phone - Booking.com column is "Phone number"
  transformed.phone = formatPhone(row["Phone number"]);
  
  // Country - Booking.com uses 2-letter codes in "Booker country"
  transformed.country = formatCountryCode(row["Booker country"] || "");
  
  // Property and Room from "Unit type"
  // Example: "Double Room at The Riad"
  const unitType = row["Unit type"] || "";
  transformed.property = mapUnitToProperty(unitType);
  transformed.room = extractRoomFromUnit(unitType);
  
  // Price - strip " EUR"
  transformed.total_eur = parsePrice(row["Price"] || "");
  
  // Extract arrival time from remarks
  transformed.arrival_time_stated = extractArrivalTime(row["Remarks"] || "");
  
  // Set source
  transformed.source = "Booking.com";
  
  // Timestamps
  transformed.created_at = new Date().toISOString();
  transformed.updated_at = new Date().toISOString();

  return transformed;
}

function transformAirbnbRow(row: Record<string, string>): Record<string, string> {
  const transformed: Record<string, string> = {};
  
  HEADERS.forEach((h) => {
    transformed[h] = "";
  });

  // Map known columns
  for (const [abCol, ourCol] of Object.entries(AIRBNB_MAP)) {
    if (row[abCol] !== undefined && row[abCol] !== "") {
      transformed[ourCol] = row[abCol];
    }
  }

  // Split guest name - try multiple possible column names
  const guestName = row["Guest"] || row["Guest name"] || row["Guest Name"] || transformed.guest_name_raw || "";
  if (guestName) {
    const nameParts = guestName.trim().split(/\s+/);
    transformed.first_name = nameParts[0] || "";
    transformed.last_name = nameParts.slice(1).join(" ") || "";
  }
  delete (transformed as Record<string, unknown>).guest_name_raw;

  // Email - try multiple columns
  if (!transformed.email) {
    transformed.email = row["Email"] || row["Guest email"] || row["Guest Email"] || "";
  }
  
  // Phone - format it
  const rawPhone = transformed.phone || row["Contact"] || row["Phone"] || row["Phone number"] || "";
  transformed.phone = formatPhone(rawPhone);
  
  // Property and Room - use unified mapping
  const listing = transformed.property || row["Listing"] || row["Listing name"] || "";
  const { property, room } = mapUnitToPropertyAndRoom(listing);
  transformed.property = property;
  transformed.room = room;
  
  // Total - clean up earnings
  if (transformed.total_eur) {
    transformed.total_eur = parsePrice(transformed.total_eur);
  }
  
  // Calculate total guests if not provided
  if (!transformed.guests) {
    const adults = parseInt(transformed.adults || "0", 10);
    const children = parseInt(transformed.children || "0", 10);
    if (adults + children > 0) {
      transformed.guests = String(adults + children);
    }
  }
  
  // Normalize status
  transformed.status = normalizeStatus(transformed.status || "confirmed");
  
  transformed.source = "Airbnb";
  transformed.created_at = new Date().toISOString();
  transformed.updated_at = new Date().toISOString();

  return transformed;
}

// Fields to compare for detecting changes
const fieldsToCompare = [
  "status",
  "first_name",
  "last_name",
  "email",
  "phone",
  "country",
  "property",
  "room",
  "check_in",
  "check_out",
  "nights",
  "guests",
  "adults",
  "children",
  "total_eur",
  "special_requests",
];

function hasChanges(
  existing: Record<string, string>,
  incoming: Record<string, string>
): boolean {
  for (const field of fieldsToCompare) {
    const existingVal = (existing[field] || "").toString().trim().toLowerCase();
    const incomingVal = (incoming[field] || "").toString().trim().toLowerCase();
    if (existingVal !== incomingVal && incomingVal !== "") {
      return true;
    }
  }
  return false;
}

function mergeRecords(
  existing: Record<string, string>,
  incoming: Record<string, string>
): Record<string, string> {
  const merged = { ...existing };

  for (const field of fieldsToCompare) {
    const incomingVal = incoming[field];
    if (incomingVal && incomingVal.trim() !== "") {
      merged[field] = incomingVal;
    }
  }

  merged.updated_at = new Date().toISOString();
  return merged;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    let headers: string[];
    let rows: Record<string, string>[];

    // Parse file based on type
    if (fileName.endsWith(".csv")) {
      const text = await file.text();
      const parsed = parseCSV(text);
      headers = parsed.headers;
      rows = parsed.rows;
    } else if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelFile(buffer);
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Use CSV, XLS, or XLSX." },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data found in file" },
        { status: 400 }
      );
    }

    // Detect source
    const source = detectSource(headers);
    if (source === "unknown") {
      return NextResponse.json(
        { 
          error: "Could not detect source. Expected Booking.com or Airbnb export.",
          detectedHeaders: headers.slice(0, 10)
        },
        { status: 400 }
      );
    }

    // Ensure tab exists with headers
    await ensureTabExists("Master_Guests", HEADERS);

    // Get existing bookings
    const existingData = await getSheetData("Master_Guests");
    const existingRows = rowsToObjects<Record<string, string>>(existingData);
    const existingByBookingId = new Map<string, { row: Record<string, string>; index: number }>();
    
    existingRows.forEach((row, index) => {
      if (row.booking_id) {
        // Store 0-based data row index (not sheet row)
        existingByBookingId.set(row.booking_id.trim(), { row, index });
      }
    });

    // Transform and process rows
    const results = {
      added: 0,
      updated: 0,
      unchanged: 0,
      cancelled: 0,
      errors: [] as string[],
    };

    const toAdd: Record<string, string>[] = [];

    for (const row of rows) {
      try {
        const transformed = source === "booking.com" 
          ? transformBookingComRow(row)
          : transformAirbnbRow(row);

        if (!transformed.booking_id) {
          results.errors.push("Row missing booking ID");
          continue;
        }

        // Normalize booking_id for comparison
        const bookingId = transformed.booking_id.trim();

        // Skip cancelled bookings if they're not in our system
        if (transformed.status === "cancelled") {
          const existing = existingByBookingId.get(bookingId);
          if (!existing) {
            results.cancelled++;
            continue;
          }
        }

        const existing = existingByBookingId.get(bookingId);

        if (existing) {
          // Check if there are changes
          if (hasChanges(existing.row, transformed)) {
            const merged = mergeRecords(existing.row, transformed);
            const rowData = objectToRow(merged, HEADERS);
            await updateSheetRow("Master_Guests", existing.index, rowData);
            results.updated++;
          } else {
            results.unchanged++;
          }
        } else {
          // New booking
          toAdd.push(transformed);
          results.added++;
        }
      } catch (err) {
        results.errors.push(`Error processing row: ${err}`);
      }
    }

    // Batch add new rows
    if (toAdd.length > 0) {
      const rowsData = toAdd.map((r) => objectToRow(r, HEADERS));
      await appendToSheet("Master_Guests", rowsData);
    }

    return NextResponse.json({
      success: true,
      source,
      results,
      totalProcessed: rows.length,
      detectedHeaders: headers.slice(0, 15), // Show first 15 headers for debugging
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}
