import { google } from "googleapis";

// Single Ops sheet for all operations and guest management
// Kept separate from Riad di Siena website content sheet
const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function formatPrivateKey(key: string): string {
  // Remove any surrounding quotes
  let cleaned = key.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Handle various newline escape formats:
  // 1. Literal \n (two chars) -> actual newline
  // 2. Double-escaped \\n -> actual newline
  // 3. JSON-escaped \n in a string
  cleaned = cleaned
    .replace(/\\\\n/g, "\n")  // Double-escaped
    .replace(/\\n/g, "\n");    // Single-escaped
  
  // Ensure proper PEM format
  if (!cleaned.includes("-----BEGIN") && cleaned.length > 100) {
    // Key might be without headers - try to reconstruct
    const base64Content = cleaned.replace(/\s/g, "");
    cleaned = `-----BEGIN PRIVATE KEY-----\n${base64Content.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----\n`;
  }
  
  return cleaned;
}

function getAuth() {
  // Support multiple env var naming conventions
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  // Get private key (try raw first, then base64)
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!privateKey && process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    privateKey = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  
  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google credentials. Set GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY in Vercel environment variables");
  }

  // Format the private key properly
  privateKey = formatPrivateKey(privateKey);

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// Test authentication without exposing secrets
export async function testAuth(): Promise<{ success: boolean; error?: string; details?: string }> {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const hasPrivateKey = !!(process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64);
    const hasSheetId = !!SHEET_ID;
    
    if (!clientEmail) {
      return { success: false, error: "Missing GOOGLE_CLIENT_EMAIL", details: "Set this in Vercel Environment Variables" };
    }
    if (!hasPrivateKey) {
      return { success: false, error: "Missing GOOGLE_PRIVATE_KEY", details: "Set this in Vercel Environment Variables" };
    }
    if (!hasSheetId) {
      return { success: false, error: "Missing GOOGLE_SPREADSHEET_ID", details: "Set this in Vercel Environment Variables" };
    }
    
    // Try to authenticate
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    
    // Try a simple read operation
    await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: "spreadsheetId",
    });
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    
    if (message.includes("invalid_grant") || message.includes("JWT")) {
      return { 
        success: false, 
        error: "Invalid JWT Signature",
        details: "The GOOGLE_PRIVATE_KEY format is incorrect. In Vercel: 1) Delete the existing key 2) Re-paste the entire key from your JSON file 3) Make sure to include the -----BEGIN and -----END lines"
      };
    }
    
    if (message.includes("not found") || message.includes("404")) {
      return {
        success: false,
        error: "Spreadsheet not found",
        details: "Check GOOGLE_SPREADSHEET_ID and ensure the service account has access"
      };
    }
    
    return { success: false, error: message };
  }
}

export function getSheetId(): string {
  if (!SHEET_ID) throw new Error("Missing GOOGLE_SPREADSHEET_ID");
  return SHEET_ID;
}

export async function getSheetData(tabName: string): Promise<string[][]> {
  if (!SHEET_ID) throw new Error("Missing GOOGLE_SPREADSHEET_ID");
  
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:ZZ`,
  });

  return response.data.values || [];
}

export async function appendToSheet(tabName: string, rows: string[][]): Promise<void> {
  if (!SHEET_ID) throw new Error("Missing GOOGLE_SPREADSHEET_ID");
  
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:A`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: rows,
    },
  });
}

export async function updateSheetRow(
  tabName: string,
  rowIndex: number,
  values: string[]
): Promise<void> {
  if (!SHEET_ID) throw new Error("Missing GOOGLE_SPREADSHEET_ID");
  
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // rowIndex is 0-based data row, add 2 for header + 1-based indexing
  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A${sheetRow}:ZZ${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values],
    },
  });
}

export async function deleteRow(tabName: string, rowIndex: number): Promise<void> {
  if (!SHEET_ID) throw new Error("Missing GOOGLE_SPREADSHEET_ID");
  
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Get sheet ID for the tab
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === tabName
  );
  
  if (!sheet?.properties?.sheetId) {
    throw new Error(`Tab "${tabName}" not found`);
  }

  const sheetRow = rowIndex + 2; // 0-based data row + header + 1-based

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: "ROWS",
              startIndex: sheetRow - 1, // 0-based for API
              endIndex: sheetRow,
            },
          },
        },
      ],
    },
  });
}

export async function ensureTabExists(tabName: string, headers: string[]): Promise<void> {
  if (!SHEET_ID) throw new Error("Missing GOOGLE_SPREADSHEET_ID");
  
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Check if tab exists
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const tabExists = spreadsheet.data.sheets?.some(
    (s) => s.properties?.title === tabName
  );

  if (!tabExists) {
    // Create the tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      },
    });

    // Add headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [headers],
      },
    });
  }
}

export function rowsToObjects<T extends Record<string, string>>(
  rows: string[][]
): T[] {
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || "";
    });
    return obj as T;
  });
}

export function objectToRow(
  obj: Record<string, string>,
  headers: string[]
): string[] {
  return headers.map((h) => obj[h] || "");
}

export function convertDriveUrl(url: string): string {
  if (!url) return "";
  
  // Already a direct URL (not Google Drive)
  if (!url.includes("drive.google.com")) return url;
  
  // Extract file ID from various Google Drive URL formats
  let fileId = "";
  
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  }
  
  // Format: https://drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    fileId = openMatch[1];
  }
  
  // Format: https://drive.google.com/uc?id=FILE_ID
  const ucMatch = url.match(/\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) {
    fileId = ucMatch[1];
  }
  
  if (fileId) {
    // Return thumbnail URL with large size (w1600 = 1600px width)
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
  }
  
  // If no match, return original URL
  return url;
}
