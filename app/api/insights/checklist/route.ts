import { NextResponse } from "next/server";
import { google } from "googleapis";

const CHECKLIST_TAB = "Issues_Checklist";

async function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function ensureChecklistTab(sheets: any, sheetId: string) {
  try {
    // Check if tab exists
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    
    const tabExists = response.data.sheets?.some(
      (sheet: any) => sheet.properties?.title === CHECKLIST_TAB
    );
    
    if (!tabExists) {
      // Create the tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: CHECKLIST_TAB,
                },
              },
            },
          ],
        },
      });
      
      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${CHECKLIST_TAB}!A1:E1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["issue_id", "issue_text", "category", "resolved", "resolved_date"]],
        },
      });
    }
  } catch (error) {
    console.error("Error ensuring checklist tab:", error);
  }
}

// GET - fetch all checklist items
export async function GET() {
  try {
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.OPS_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
    
    await ensureChecklistTab(sheets, sheetId!);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${CHECKLIST_TAB}!A:E`,
    });
    
    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ items: [] });
    }
    
    const items = rows.slice(1).map(row => ({
      issue_id: row[0] || "",
      issue_text: row[1] || "",
      category: row[2] || "",
      resolved: row[3] === "true",
      resolved_date: row[4] || "",
    }));
    
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching checklist:", error);
    return NextResponse.json({ error: "Failed to fetch checklist" }, { status: 500 });
  }
}

// POST - add or update checklist item
export async function POST(request: Request) {
  try {
    const { issue_id, issue_text, category, resolved } = await request.json();
    
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.OPS_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
    
    await ensureChecklistTab(sheets, sheetId!);
    
    // Check if issue already exists
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${CHECKLIST_TAB}!A:E`,
    });
    
    const rows = response.data.values || [];
    let rowIndex = -1;
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === issue_id) {
        rowIndex = i + 1; // 1-indexed for sheets
        break;
      }
    }
    
    const resolvedDate = resolved ? new Date().toISOString().split("T")[0] : "";
    
    if (rowIndex > 0) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${CHECKLIST_TAB}!A${rowIndex}:E${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[issue_id, issue_text, category, resolved.toString(), resolvedDate]],
        },
      });
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${CHECKLIST_TAB}!A:E`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[issue_id, issue_text, category, resolved.toString(), resolvedDate]],
        },
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating checklist:", error);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}
