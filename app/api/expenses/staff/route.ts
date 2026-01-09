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

function getTabName(staff: string): string {
  if (staff === "zahra") return "Expenses_Zahra";
  if (staff === "mouad") return "Expenses_Mouad";
  throw new Error("Invalid staff member");
}

// GET - Fetch expenses for a specific staff member
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staff = searchParams.get("staff");
    
    if (!staff || !["zahra", "mouad"].includes(staff)) {
      return NextResponse.json({ error: "Invalid staff parameter" }, { status: 400 });
    }

    const sheets = await getSheets();
    const tabName = getTabName(staff);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: OPS_SHEET_ID,
      range: `${tabName}!A2:G1000`,
    });

    const rows = response.data.values || [];
    
    const expenses = rows
      .filter(row => row[0]) // Has expense_id
      .map(row => ({
        expense_id: row[0] || "",
        date: row[1] || "",
        description: row[2] || "",
        category: row[3] || "",
        amount_dh: parseFloat(row[4]) || 0,
        receipt_url: row[5] || "",
        created_at: row[6] || "",
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Error fetching staff expenses:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

// POST - Add expense for a specific staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff, date, description, category, amount_dh, receipt_url } = body;

    if (!staff || !["zahra", "mouad"].includes(staff)) {
      return NextResponse.json({ error: "Invalid staff parameter" }, { status: 400 });
    }

    if (!date || !description || !category || amount_dh === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sheets = await getSheets();
    const tabName = getTabName(staff);
    
    // Generate expense ID
    const prefix = staff === "zahra" ? "EXP-Z" : "EXP-M";
    const expense_id = `${prefix}-${Date.now()}`;
    const created_at = new Date().toISOString();

    // Append to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: OPS_SHEET_ID,
      range: `${tabName}!A:G`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          expense_id,
          date,
          description,
          category,
          amount_dh,
          receipt_url || "",
          created_at,
        ]],
      },
    });

    return NextResponse.json({ 
      success: true, 
      expense_id,
      message: "Expense saved" 
    });
  } catch (error) {
    console.error("Error saving staff expense:", error);
    return NextResponse.json({ error: "Failed to save expense" }, { status: 500 });
  }
}
