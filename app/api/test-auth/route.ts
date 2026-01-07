import { NextResponse } from "next/server";
import { testAuth } from "@/lib/sheets";

export async function GET() {
  const result = await testAuth();
  
  if (result.success) {
    return NextResponse.json({
      status: "ok",
      message: "Google Sheets authentication successful",
    });
  }
  
  return NextResponse.json({
    status: "error",
    error: result.error,
    details: result.details,
    help: [
      "1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables",
      "2. Ensure GOOGLE_CLIENT_EMAIL is set (e.g., journey-creator@...iam.gserviceaccount.com)",
      "3. Ensure GOOGLE_PRIVATE_KEY is set with the full key including -----BEGIN and -----END lines",
      "4. Ensure GOOGLE_SPREADSHEET_ID is set to the ops sheet ID",
      "5. Redeploy after making changes",
    ],
  }, { status: 500 });
}
