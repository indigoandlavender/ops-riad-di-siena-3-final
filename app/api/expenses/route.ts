import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = process.env.OPS_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth;
}

async function getSheets() {
  const auth = await getAuthClient();
  return google.sheets({ version: "v4", auth });
}

// GET - List all expenses
export async function GET() {
  try {
    const sheets = await getSheets();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Expenses!A2:G1000",
    });

    const rows = response.data.values || [];
    
    const expenses = rows.map((row) => ({
      expense_id: row[0] || "",
      date: row[1] || "",
      description: row[2] || "",
      category: row[3] || "",
      amount_dh: parseFloat(row[4]) || 0,
      receipt_url: row[5] || "",
      created_at: row[6] || "",
    })).filter(e => e.expense_id);

    // Sort by date descending
    expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate totals by category
    const byCategory: Record<string, number> = {};
    let total = 0;
    expenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount_dh;
      total += e.amount_dh;
    });

    // Monthly totals
    const byMonth: Record<string, number> = {};
    expenses.forEach(e => {
      const month = e.date.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + e.amount_dh;
    });

    return NextResponse.json({
      expenses,
      summary: {
        total,
        byCategory,
        byMonth,
        count: expenses.length,
      },
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

// POST - Add new expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, description, category, amount_dh, receipt_url } = body;

    if (!date || !description || !category || !amount_dh) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sheets = await getSheets();
    
    const expense_id = `EXP-${Date.now()}`;
    const created_at = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Expenses!A:G",
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
      expense: {
        expense_id,
        date,
        description,
        category,
        amount_dh,
        receipt_url,
        created_at,
      },
    });
  } catch (error) {
    console.error("Error adding expense:", error);
    return NextResponse.json({ error: "Failed to add expense" }, { status: 500 });
  }
}

// DELETE - Remove expense
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const expense_id = searchParams.get("id");

    if (!expense_id) {
      return NextResponse.json({ error: "Missing expense ID" }, { status: 400 });
    }

    const sheets = await getSheets();

    // Get all expenses to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Expenses!A:G",
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === expense_id);

    if (rowIndex === -1) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Get sheet ID for Expenses tab
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });

    const expensesSheet = sheetMeta.data.sheets?.find(
      s => s.properties?.title === "Expenses"
    );

    if (!expensesSheet?.properties?.sheetId) {
      return NextResponse.json({ error: "Expenses sheet not found" }, { status: 500 });
    }

    // Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: expensesSheet.properties.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        }],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
