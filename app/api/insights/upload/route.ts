import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    
    // Validate file type
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "File must be a CSV" }, { status: 400 });
    }
    
    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), "data");
    try {
      await mkdir(dataDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
    
    // Write to data/reviews.csv
    const filePath = path.join(dataDir, "reviews.csv");
    await writeFile(filePath, buffer);
    
    // Count rows to confirm
    const content = buffer.toString("utf-8");
    const lines = content.split("\n").filter(line => line.trim());
    const rowCount = Math.max(0, lines.length - 1); // Subtract header row
    
    return NextResponse.json({ 
      success: true, 
      message: `Uploaded ${rowCount} reviews`,
      rowCount 
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
