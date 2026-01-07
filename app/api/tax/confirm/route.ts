import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: "Missing booking ID" },
        { status: 400 }
      );
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    // Find the row with this booking ID in Master_Guests
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Master_Guests!A:ZZ",
    });

    const rows = getResponse.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "No data found" },
        { status: 404 }
      );
    }

    // Find header row and relevant columns
    const headers = rows[0];
    const bookingIdCol = headers.findIndex(
      (h: string) => h.toLowerCase().replace(/[_\s]/g, "") === "bookingid"
    );
    const cityTaxPaidCol = headers.findIndex(
      (h: string) => h.toLowerCase().replace(/[_\s]/g, "") === "citytaxpaid"
    );

    if (bookingIdCol === -1) {
      return NextResponse.json(
        { error: "Booking ID column not found" },
        { status: 500 }
      );
    }

    // Find the row with matching booking ID
    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][bookingIdCol] === bookingId) {
        targetRowIndex = i;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (cityTaxPaidCol === -1) {
      return NextResponse.json(
        { error: "City tax column not configured. Please add 'city_tax_paid' column to Master_Guests." },
        { status: 500 }
      );
    }

    // Update the city_tax_paid cell with timestamp
    const colLetter = String.fromCharCode(65 + cityTaxPaidCol);
    const cellRange = `Master_Guests!${colLetter}${targetRowIndex + 1}`;
    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[timestamp]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tax payment confirm error:", error);
    return NextResponse.json(
      { error: "Failed to record tax payment" },
      { status: 500 }
    );
  }
}
