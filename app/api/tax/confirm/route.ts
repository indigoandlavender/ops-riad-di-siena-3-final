import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { sendPaymentEmails } from "@/lib/email";

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
    const getColIndex = (name: string) => headers.findIndex(
      (h: string) => h.toLowerCase().replace(/[_\s]/g, "") === name.toLowerCase().replace(/[_\s]/g, "")
    );

    const bookingIdCol = getColIndex("bookingid");
    const cityTaxPaidCol = getColIndex("citytaxpaid");
    const firstNameCol = getColIndex("firstname");
    const lastNameCol = getColIndex("lastname");
    const guestNameCol = getColIndex("guestname");
    const emailCol = getColIndex("email");
    const whatsappCol = getColIndex("whatsapp");
    const phoneCol = getColIndex("phone");
    const checkInCol = getColIndex("checkin");
    const checkOutCol = getColIndex("checkout");
    const nightsCol = getColIndex("nights");
    const guestsCol = getColIndex("guests");
    const roomCol = getColIndex("room");
    const propertyCol = getColIndex("property");
    const totalCol = getColIndex("totaleur") !== -1 ? getColIndex("totaleur") : getColIndex("total");

    if (bookingIdCol === -1) {
      return NextResponse.json(
        { error: "Booking ID column not found" },
        { status: 500 }
      );
    }

    // Find the row with matching booking ID
    let targetRowIndex = -1;
    let bookingRow: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][bookingIdCol] === bookingId) {
        targetRowIndex = i;
        bookingRow = rows[i];
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

    // Extract booking details for email
    const getValue = (col: number) => (col !== -1 && bookingRow[col]) ? bookingRow[col] : "";

    let guestName = getValue(guestNameCol);
    if (!guestName) {
      guestName = [getValue(firstNameCol), getValue(lastNameCol)].filter(Boolean).join(" ");
    }

    const nights = parseInt(getValue(nightsCol)) || 1;
    const guestCount = parseInt(getValue(guestsCol)) || 1;
    const cityTax = 2.5 * nights * guestCount;
    const totalPaid = parseFloat(getValue(totalCol)) || 0;
    const roomTotal = totalPaid - cityTax;

    // Get WhatsApp (fallback to phone if whatsapp column doesn't exist)
    const whatsapp = getValue(whatsappCol) || getValue(phoneCol);

    // Send emails (admin notification + guest confirmation)
    const emailResult = await sendPaymentEmails({
      bookingId,
      guestName: guestName || "Guest",
      guestEmail: getValue(emailCol),
      whatsapp,
      checkIn: getValue(checkInCol).split("T")[0],
      checkOut: getValue(checkOutCol).split("T")[0],
      nights,
      guests: guestCount,
      room: getValue(roomCol),
      property: getValue(propertyCol),
      roomTotal: roomTotal > 0 ? roomTotal : undefined,
      cityTax,
      totalPaid: totalPaid > 0 ? totalPaid : cityTax,
    });

    // Log email results but don't fail the payment confirmation if emails fail
    if (emailResult.errors.length > 0) {
      console.warn("Email sending issues:", emailResult.errors);
    }

    return NextResponse.json({
      success: true,
      emailsSent: {
        admin: emailResult.adminSent,
        guest: emailResult.guestSent,
      }
    });
  } catch (error) {
    console.error("Tax payment confirm error:", error);
    return NextResponse.json(
      { error: "Failed to record tax payment" },
      { status: 500 }
    );
  }
}
