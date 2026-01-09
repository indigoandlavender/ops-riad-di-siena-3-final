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

// GET - Fetch petty cash entries and calculate balances
export async function GET() {
  try {
    const sheets = await getSheets();
    
    // Fetch entries from Petty_Cash tab
    // Columns: date | person | type | amount | notes
    let entries: Array<{
      id: string;
      date: string;
      person: string;
      type: "advance" | "return";
      amount: number;
      notes: string;
    }> = [];
    
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: OPS_SHEET_ID,
        range: "Petty_Cash!A2:E1000",
      });
      
      const rows = res.data.values || [];
      entries = rows
        .filter(row => row[0])
        .map((row, idx) => ({
          id: `PC-${idx}`,
          date: row[0] || "",
          person: (row[1] || "").toLowerCase(),
          type: (row[2] || "advance").toLowerCase() as "advance" | "return",
          amount: parseFloat(row[3]) || 0,
          notes: row[4] || "",
        }));
    } catch (e) {
      console.log("Petty_Cash tab not found");
    }

    // Fetch notes from Petty_Cash_Notes tab
    let notes: Array<{ id: string; date: string; note: string }> = [];
    try {
      const notesRes = await sheets.spreadsheets.values.get({
        spreadsheetId: OPS_SHEET_ID,
        range: "Petty_Cash_Notes!A2:B1000",
      });
      const rows = notesRes.data.values || [];
      notes = rows
        .filter(row => row[0])
        .map((row, idx) => ({
          id: `NOTE-${idx}`,
          date: row[0] || "",
          note: row[1] || "",
        }));
    } catch (e) {
      console.log("Petty_Cash_Notes tab not found - will be created on first note");
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

    // Calculate totals for Zahra
    const zahraAdvances = entries
      .filter(e => e.person === "zahra" && e.type === "advance")
      .reduce((sum, e) => sum + e.amount, 0);
    const zahraReturns = entries
      .filter(e => e.person === "zahra" && e.type === "return")
      .reduce((sum, e) => sum + e.amount, 0);
    
    // Calculate totals for Mouad
    const mouadAdvances = entries
      .filter(e => e.person === "mouad" && e.type === "advance")
      .reduce((sum, e) => sum + e.amount, 0);
    const mouadReturns = entries
      .filter(e => e.person === "mouad" && e.type === "return")
      .reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({
      entries,
      notes,
      balances: {
        zahra: {
          given: zahraAdvances,
          returned: zahraReturns,
          spent: zahraSpent,
          balance: zahraAdvances - zahraReturns - zahraSpent,
        },
        mouad: {
          given: mouadAdvances,
          returned: mouadReturns,
          spent: mouadSpent,
          balance: mouadAdvances - mouadReturns - mouadSpent,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching petty cash:", error);
    return NextResponse.json({ error: "Failed to fetch petty cash" }, { status: 500 });
  }
}

// POST - Add new advance, return, or note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sheets = await getSheets();

    // Handle note submission
    if (body.action === "add_note") {
      const { note } = body;
      if (!note) {
        return NextResponse.json({ error: "Note content required" }, { status: 400 });
      }

      const today = new Date().toISOString().split("T")[0];

      await sheets.spreadsheets.values.append({
        spreadsheetId: OPS_SHEET_ID,
        range: "Petty_Cash_Notes!A:B",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[today, note]],
        },
      });

      return NextResponse.json({ success: true });
    }

    // Handle transaction submission
    const { date, person, type, amount, notes } = body;

    if (!date || !person || !type || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["zahra", "mouad"].includes(person.toLowerCase())) {
      return NextResponse.json({ error: "Invalid person" }, { status: 400 });
    }

    if (!["advance", "return"].includes(type.toLowerCase())) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: OPS_SHEET_ID,
      range: "Petty_Cash!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          date,
          person.toLowerCase(),
          type.toLowerCase(),
          amount,
          notes || "",
        ]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding entry:", error);
    return NextResponse.json({ error: "Failed to add entry" }, { status: 500 });
  }
}
