import { NextResponse } from "next/server";
import { google } from "googleapis";

const OPS_SHEET_ID = process.env.OPS_SHEET_ID || "1qBOHt08Y5_2dn1dmBdZjKJQR9ShjacZLdLJvsK787Qo";

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

export async function POST(request: Request) {
  try {
    const { booking_id } = await request.json();

    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
    }

    const sheets = await getGoogleSheets();

    // Find the booking row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: OPS_SHEET_ID,
      range: "Master_Guests!A:Z",
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    const headers = rows[0];
    const bookingIdCol = headers.indexOf("booking_id");
    const cityTaxPaidCol = headers.indexOf("city_tax_paid");

    if (bookingIdCol === -1) {
      return NextResponse.json({ error: "booking_id column not found" }, { status: 500 });
    }

    // Find the row with this booking_id
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][bookingIdCol] === booking_id) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // If city_tax_paid column doesn't exist, we need to add it
    let targetCol = cityTaxPaidCol;
    if (targetCol === -1) {
      // Add city_tax_paid header
      targetCol = headers.length;
      await sheets.spreadsheets.values.update({
        spreadsheetId: OPS_SHEET_ID,
        range: `Master_Guests!${columnToLetter(targetCol + 1)}1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["city_tax_paid"]],
        },
      });
    }

    // Update the city_tax_paid field with current timestamp
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.update({
      spreadsheetId: OPS_SHEET_ID,
      range: `Master_Guests!${columnToLetter(targetCol + 1)}${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[timestamp]],
      },
    });

    return NextResponse.json({ success: true, timestamp });
  } catch (error) {
    console.error("Error marking tax as paid:", error);
    return NextResponse.json({ error: "Failed to mark tax as paid" }, { status: 500 });
  }
}

function columnToLetter(column: number): string {
  let letter = "";
  while (column > 0) {
    const remainder = (column - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    column = Math.floor((column - 1) / 26);
  }
  return letter;
}
