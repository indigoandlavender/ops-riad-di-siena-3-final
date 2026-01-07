import { NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function formatPrivateKey(key: string): string {
  let cleaned = key.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");
  return cleaned;
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!privateKey && process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    privateKey = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google credentials");
  }
  privateKey = formatPrivateKey(privateKey);
  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function POST() {
  try {
    if (!SHEET_ID) throw new Error("Missing GOOGLE_SPREADSHEET_ID");
    
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Get all data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Master_Guests!A:ZZ",
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ message: "No data to deduplicate" });
    }

    const headers = rows[0];
    const bookingIdIndex = headers.indexOf("booking_id");
    
    if (bookingIdIndex === -1) {
      return NextResponse.json({ error: "booking_id column not found" }, { status: 400 });
    }

    // Find duplicates - keep the LAST occurrence (most recently updated)
    const seen = new Map<string, number>(); // booking_id -> last seen row index
    const duplicateRowIndices: number[] = [];

    for (let i = 1; i < rows.length; i++) {
      const bookingId = (rows[i][bookingIdIndex] || "").trim();
      if (!bookingId) continue;
      
      if (seen.has(bookingId)) {
        // Mark the previous occurrence for deletion
        duplicateRowIndices.push(seen.get(bookingId)!);
      }
      seen.set(bookingId, i);
    }

    if (duplicateRowIndices.length === 0) {
      return NextResponse.json({ 
        message: "No duplicates found",
        totalRows: rows.length - 1,
        uniqueBookings: seen.size
      });
    }

    // Sort in descending order so we delete from bottom up (indices stay valid)
    duplicateRowIndices.sort((a, b) => b - a);

    // Get sheet ID for batch delete
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === "Master_Guests"
    );
    if (!sheet?.properties?.sheetId) {
      throw new Error("Master_Guests tab not found");
    }
    const sheetId = sheet.properties.sheetId;

    // Delete rows in batches (from bottom to top)
    const deleteRequests = duplicateRowIndices.map((rowIndex) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));

    // Execute in chunks of 100 to avoid API limits
    const chunkSize = 100;
    let deleted = 0;
    
    for (let i = 0; i < deleteRequests.length; i += chunkSize) {
      const chunk = deleteRequests.slice(i, i + chunkSize);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: chunk },
      });
      deleted += chunk.length;
    }

    return NextResponse.json({
      success: true,
      duplicatesRemoved: deleted,
      remainingRows: rows.length - 1 - deleted,
      uniqueBookings: seen.size
    });
  } catch (error) {
    console.error("Deduplicate error:", error);
    return NextResponse.json(
      { error: "Deduplication failed", details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to preview duplicates without deleting
export async function GET() {
  try {
    if (!SHEET_ID) throw new Error("Missing GOOGLE_SPREADSHEET_ID");
    
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Master_Guests!A:ZZ",
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ message: "No data", totalRows: 0 });
    }

    const headers = rows[0];
    const bookingIdIndex = headers.indexOf("booking_id");
    const firstNameIndex = headers.indexOf("first_name");
    const lastNameIndex = headers.indexOf("last_name");
    const checkInIndex = headers.indexOf("check_in");
    
    if (bookingIdIndex === -1) {
      return NextResponse.json({ error: "booking_id column not found" }, { status: 400 });
    }

    // Count occurrences
    const counts = new Map<string, { count: number; rows: number[]; name: string; checkIn: string }>();

    for (let i = 1; i < rows.length; i++) {
      const bookingId = (rows[i][bookingIdIndex] || "").trim();
      if (!bookingId) continue;
      
      const existing = counts.get(bookingId);
      const name = [rows[i][firstNameIndex], rows[i][lastNameIndex]].filter(Boolean).join(" ");
      const checkIn = rows[i][checkInIndex] || "";
      
      if (existing) {
        existing.count++;
        existing.rows.push(i + 1); // 1-based for display
      } else {
        counts.set(bookingId, { count: 1, rows: [i + 1], name, checkIn });
      }
    }

    // Find duplicates
    const duplicates: { bookingId: string; count: number; rows: number[]; name: string; checkIn: string }[] = [];
    counts.forEach((value, key) => {
      if (value.count > 1) {
        duplicates.push({ bookingId: key, ...value });
      }
    });

    return NextResponse.json({
      totalRows: rows.length - 1,
      uniqueBookings: counts.size,
      duplicateCount: duplicates.reduce((sum, d) => sum + d.count - 1, 0),
      duplicates: duplicates.slice(0, 50), // Show first 50
    });
  } catch (error) {
    console.error("Deduplicate check error:", error);
    return NextResponse.json(
      { error: "Check failed", details: String(error) },
      { status: 500 }
    );
  }
}
