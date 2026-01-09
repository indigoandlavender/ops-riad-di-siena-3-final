import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const OPS_SHEET_ID = process.env.OPS_SHEET_ID || "1qBOHt08Y5_2dn1dmBdZjKJQR9ShjacZLdLJvsK787Qo";

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// GET - Fetch petty cash advances and calculate balances
export async function GET() {
  try {
    const sheets = await getSheets();
    
    // Fetch advances from Petty_Cash tab
    let advances: Array<{
      id: string;
      date: string;
      person: string;
      amount: number;
      notes: string;
    }> = [];
    
    try {
      const advanceRes = await sheets.spreadsheets.values.get({
        spreadsheetId: OPS_SHEET_ID,
        range: "Petty_Cash!A2:E1000",
      });
      
      const rows = advanceRes.data.values || [];
      advances = rows
        .filter(row => row[0])
        .map((row, idx) => ({
          id: `PC-${idx}`,
          date: row[0] || "",
          person: (row[1] || "").toLowerCase(),
          amount: parseFloat(row[2]) || 0,
          notes: row[3] || "",
        }));
    } catch (e) {
      console.log("Petty_Cash tab not found");
    }

    // Fetch expenses for Zahra
    let zahraSpent = 0;
    try {
      const zahraRes = await sheets.spreadsheets.values.get({
        spreadsheetId: OPS_SHEET_ID,
        range: "Expenses_Zahra!A2:G1000",
      });
      const rows = zahraRes.data.values || [];
      zahraSpent = rows
        .filter(row => row[0])
        .reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0);
    } catch (e) {
      console.log("Expenses_Zahra tab not found");
    }

    // Fetch expenses for Mouad
    let mouadSpent = 0;
    try {
      const mouadRes = await sheets.spreadsheets.values.get({
        spreadsheetId: OPS_SHEET_ID,
        range: "Expenses_Mouad!A2:G1000",
      });
      const rows = mouadRes.data.values || [];
      mouadSpent = rows
        .filter(row => row[0])
        .reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0);
    } catch (e) {
      console.log("Expenses_Mouad tab not found");
    }

    // Calculate totals
    const zahraAdvances = advances
      .filter(a => a.person === "zahra")
      .reduce((sum, a) => sum + a.amount, 0);
    
    const mouadAdvances = advances
      .filter(a => a.person === "mouad")
      .reduce((sum, a) => sum + a.amount, 0);

    return NextResponse.json({
      advances,
      balances: {
        zahra: {
          given: zahraAdvances,
          spent: zahraSpent,
          balance: zahraAdvances - zahraSpent,
        },
        mouad: {
          given: mouadAdvances,
          spent: mouadSpent,
          balance: mouadAdvances - mouadSpent,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching petty cash:", error);
    return NextResponse.json({ error: "Failed to fetch petty cash" }, { status: 500 });
  }
}

// POST - Add new advance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, person, amount, notes } = body;

    if (!date || !person || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["zahra", "mouad"].includes(person.toLowerCase())) {
      return NextResponse.json({ error: "Invalid person" }, { status: 400 });
    }

    const sheets = await getSheets();

    await sheets.spreadsheets.values.append({
      spreadsheetId: OPS_SHEET_ID,
      range: "Petty_Cash!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          date,
          person.toLowerCase(),
          amount,
          notes || "",
        ]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding advance:", error);
    return NextResponse.json({ error: "Failed to add advance" }, { status: 500 });
  }
}
