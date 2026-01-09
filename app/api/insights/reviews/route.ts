import { NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Parse CSV with proper handling of quoted fields and newlines
function parseCSV(content: string): any[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === "\n" && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  
  if (lines.length === 0) return [];
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  
  // Parse rows
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= header.length) {
      const row: any = {};
      header.forEach((key, idx) => {
        row[key.trim().replace(/"/g, "")] = values[idx]?.replace(/"/g, "").trim() || "";
      });
      rows.push(row);
    }
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

// Extract issues from negative reviews
function extractIssues(reviews: any[]): { issue: string; count: number; examples: string[]; category: string }[] {
  const issuePatterns: { pattern: RegExp; category: string; issue: string }[] = [
    { pattern: /cold|fre[díi]o|freddo|heating|heater|climatiza/i, category: "Temperature", issue: "Room too cold / heating issues" },
    { pattern: /hot|calor|caldo|air condition|ac |a\/c/i, category: "Temperature", issue: "Room too hot / AC issues" },
    { pattern: /noise|ruido|bruit|rumore|loud|music/i, category: "Noise", issue: "Noise from outside / neighbors" },
    { pattern: /smell|odor|olor|odeur/i, category: "Cleanliness", issue: "Bad smell in room/bathroom" },
    { pattern: /light|luz|luce|lamp|lighting/i, category: "Facilities", issue: "Insufficient lighting" },
    { pattern: /bathroom|baño|bagno|shower|douche/i, category: "Bathroom", issue: "Bathroom issues (small/maintenance)" },
    { pattern: /window|ventana|finestra|ventilation|ventilación/i, category: "Room", issue: "No window / poor ventilation" },
    { pattern: /wifi|internet|connection/i, category: "Facilities", issue: "WiFi / internet problems" },
    { pattern: /direction|map|find|encontrar|trouver|lost|perdu/i, category: "Access", issue: "Difficult to find / directions" },
    { pattern: /staff|personal|personnel|unfriendly/i, category: "Service", issue: "Staff-related feedback" },
    { pattern: /breakfast|desayuno|petit.déjeuner|colazione/i, category: "Food", issue: "Breakfast feedback" },
    { pattern: /tax|city.tax|tourist.tax/i, category: "Pricing", issue: "City tax surprise" },
    { pattern: /clean|limpi|propre|pulito/i, category: "Cleanliness", issue: "Cleanliness concerns" },
    { pattern: /bed|cama|lit|letto|mattress/i, category: "Comfort", issue: "Bed/mattress comfort" },
  ];
  
  const issueMap: Map<string, { count: number; examples: string[]; category: string }> = new Map();
  
  reviews.forEach(review => {
    const negativeText = review["Negative review"] || "";
    if (!negativeText || negativeText.toLowerCase() === "nada" || negativeText.toLowerCase() === "nothing" || negativeText.toLowerCase() === "niente" || negativeText.toLowerCase() === "rien") {
      return;
    }
    
    issuePatterns.forEach(({ pattern, category, issue }) => {
      if (pattern.test(negativeText)) {
        const existing = issueMap.get(issue) || { count: 0, examples: [], category };
        existing.count++;
        if (existing.examples.length < 3 && negativeText.length > 5) {
          existing.examples.push(negativeText.substring(0, 150));
        }
        issueMap.set(issue, existing);
      }
    });
  });
  
  return Array.from(issueMap.entries())
    .map(([issue, data]) => ({ issue, ...data }))
    .sort((a, b) => b.count - a.count);
}

// Calculate monthly ratings
function calculateMonthlyRatings(reviews: any[]): { month: string; avgScore: number; count: number; categories: Record<string, number> }[] {
  const monthlyData: Map<string, { scores: number[]; staff: number[]; cleanliness: number[]; location: number[]; facilities: number[]; comfort: number[]; value: number[] }> = new Map();
  
  reviews.forEach(review => {
    const dateStr = review["Review date"];
    if (!dateStr) return;
    
    const date = new Date(dateStr);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    
    const score = parseFloat(review["Review score"]);
    if (isNaN(score)) return;
    
    const existing = monthlyData.get(monthKey) || { scores: [], staff: [], cleanliness: [], location: [], facilities: [], comfort: [], value: [] };
    existing.scores.push(score);
    
    const staff = parseFloat(review["Staff"]);
    const cleanliness = parseFloat(review["Cleanliness"]);
    const location = parseFloat(review["Location"]);
    const facilities = parseFloat(review["Facilities"]);
    const comfort = parseFloat(review["Comfort"]);
    const value = parseFloat(review["Value for money"]);
    
    if (!isNaN(staff) && staff > 0) existing.staff.push(staff);
    if (!isNaN(cleanliness) && cleanliness > 0) existing.cleanliness.push(cleanliness);
    if (!isNaN(location) && location > 0) existing.location.push(location);
    if (!isNaN(facilities) && facilities > 0) existing.facilities.push(facilities);
    if (!isNaN(comfort) && comfort > 0) existing.comfort.push(comfort);
    if (!isNaN(value) && value > 0) existing.value.push(value);
    
    monthlyData.set(monthKey, existing);
  });
  
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  
  return Array.from(monthlyData.entries())
    .map(([month, data]) => ({
      month,
      avgScore: avg(data.scores),
      count: data.scores.length,
      categories: {
        staff: avg(data.staff),
        cleanliness: avg(data.cleanliness),
        location: avg(data.location),
        facilities: avg(data.facilities),
        comfort: avg(data.comfort),
        value: avg(data.value),
      }
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// Simple sentiment analysis
function analyzeSentiment(reviews: any[]): { positive: number; neutral: number; negative: number; keywords: { word: string; count: number; sentiment: "positive" | "negative" }[] } {
  const positiveWords = ["excellent", "amazing", "perfect", "wonderful", "fantastic", "great", "best", "love", "beautiful", "delicious", "friendly", "helpful", "clean", "comfortable", "recommend", "parfait", "perfecto", "ottimo", "bellissimo", "excelente", "magnifique", "super", "top", "bravo"];
  const negativeWords = ["bad", "terrible", "awful", "dirty", "cold", "noise", "smell", "problem", "issue", "disappointing", "worst", "horrible", "poor", "malo", "mauvais", "brutto", "freddo", "rumore"];
  
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  
  const wordCounts: Map<string, { count: number; sentiment: "positive" | "negative" }> = new Map();
  
  reviews.forEach(review => {
    const score = parseFloat(review["Review score"]);
    if (score >= 9) positive++;
    else if (score >= 7) neutral++;
    else negative++;
    
    const text = `${review["Positive review"] || ""} ${review["Negative review"] || ""}`.toLowerCase();
    
    positiveWords.forEach(word => {
      if (text.includes(word)) {
        const existing = wordCounts.get(word) || { count: 0, sentiment: "positive" as const };
        existing.count++;
        wordCounts.set(word, existing);
      }
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) {
        const existing = wordCounts.get(word) || { count: 0, sentiment: "negative" as const };
        existing.count++;
        wordCounts.set(word, existing);
      }
    });
  });
  
  const keywords = Array.from(wordCounts.entries())
    .map(([word, data]) => ({ word, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  
  return { positive, neutral, negative, keywords };
}

// Get occupancy data from Master_Guests
async function getOccupancyData(): Promise<Map<string, { bookings: number; nights: number }>> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = process.env.OPS_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Master_Guests!A:Z",
  });
  
  const rows = response.data.values || [];
  if (rows.length < 2) return new Map();
  
  const headers = rows[0];
  const checkinIdx = headers.indexOf("check_in");
  const checkoutIdx = headers.indexOf("check_out");
  
  const monthlyData: Map<string, { bookings: number; nights: number }> = new Map();
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const checkin = row[checkinIdx];
    if (!checkin) continue;
    
    const date = new Date(checkin);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    
    const checkout = row[checkoutIdx];
    let nights = 1;
    if (checkout) {
      const checkoutDate = new Date(checkout);
      nights = Math.max(1, Math.round((checkoutDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    const existing = monthlyData.get(monthKey) || { bookings: 0, nights: 0 };
    existing.bookings++;
    existing.nights += nights;
    monthlyData.set(monthKey, existing);
  }
  
  return monthlyData;
}

export async function GET() {
  try {
    // Read CSV file
    const csvPath = path.join(process.cwd(), "data", "reviews.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const reviews = parseCSV(csvContent);
    
    // Calculate all analytics
    const issues = extractIssues(reviews);
    const monthlyRatings = calculateMonthlyRatings(reviews);
    const sentiment = analyzeSentiment(reviews);
    const occupancy = await getOccupancyData();
    
    // Calculate correlation between ratings and occupancy
    const correlationData: { month: string; avgRating: number; occupancyNights: number }[] = [];
    monthlyRatings.forEach(({ month, avgScore }) => {
      const occ = occupancy.get(month);
      if (occ) {
        correlationData.push({
          month,
          avgRating: avgScore,
          occupancyNights: occ.nights,
        });
      }
    });
    
    // Calculate Pearson correlation coefficient
    let correlation = 0;
    if (correlationData.length > 2) {
      const n = correlationData.length;
      const sumX = correlationData.reduce((a, b) => a + b.avgRating, 0);
      const sumY = correlationData.reduce((a, b) => a + b.occupancyNights, 0);
      const sumXY = correlationData.reduce((a, b) => a + b.avgRating * b.occupancyNights, 0);
      const sumX2 = correlationData.reduce((a, b) => a + b.avgRating * b.avgRating, 0);
      const sumY2 = correlationData.reduce((a, b) => a + b.occupancyNights * b.occupancyNights, 0);
      
      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      
      correlation = denominator !== 0 ? numerator / denominator : 0;
    }
    
    // Overall stats
    const allScores = reviews.map(r => parseFloat(r["Review score"])).filter(s => !isNaN(s));
    const overallAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    
    // Score distribution
    const distribution = { "10": 0, "9": 0, "8": 0, "7": 0, "below7": 0 };
    allScores.forEach(score => {
      if (score === 10) distribution["10"]++;
      else if (score === 9) distribution["9"]++;
      else if (score === 8) distribution["8"]++;
      else if (score === 7) distribution["7"]++;
      else distribution["below7"]++;
    });
    
    return NextResponse.json({
      totalReviews: reviews.length,
      overallAverage: overallAvg,
      distribution,
      issues,
      monthlyRatings,
      sentiment,
      correlation: {
        coefficient: correlation,
        interpretation: Math.abs(correlation) < 0.3 ? "weak" : Math.abs(correlation) < 0.7 ? "moderate" : "strong",
        data: correlationData,
      },
    });
  } catch (error) {
    console.error("Error analyzing reviews:", error);
    return NextResponse.json({ error: "Failed to analyze reviews" }, { status: 500 });
  }
}
