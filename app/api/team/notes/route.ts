import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(request: NextRequest) {
  try {
    const { bookingId, notes } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    // Get all data to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Master_Guests!A:Z",
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    const headers = rows[0];
    const bookingIdCol = headers.indexOf("booking_id");
    const notesCol = headers.indexOf("notes");

    if (bookingIdCol === -1) {
      return NextResponse.json({ error: "booking_id column not found" }, { status: 500 });
    }

    // Find the row with matching booking_id
    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][bookingIdCol] === bookingId) {
        targetRow = i + 1; // 1-indexed for Sheets API
      }
    }

    if (targetRow === -1) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // If notes column doesn't exist, we need to add it
    let notesColIndex = notesCol;
    if (notesColIndex === -1) {
      // Add "notes" header
      notesColIndex = headers.length;
      const colLetter = String.fromCharCode(65 + notesColIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Master_Guests!${colLetter}1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["notes"]],
        },
      });
    }

    // Update the notes cell
    const colLetter = String.fromCharCode(65 + notesColIndex);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Master_Guests!${colLetter}${targetRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[notes || ""]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save notes error:", error);
    return NextResponse.json(
      { error: "Failed to save notes" },
      { status: 500 }
    );
  }
}
