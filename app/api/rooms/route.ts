import { NextResponse } from "next/server";
import { getSheetData, rowsToObjects, convertDriveUrl } from "@/lib/sheets";

export const revalidate = 0;

interface Room {
  room_id: string;
  name: string;
  description: string;
  price_eur: string;
  features: string;
  image_url: string;
  ical_url: string;
  order: string;
  bookable: string;
  [key: string]: string;
}

export async function GET() {
  try {
    const rows = await getSheetData("Rooms");
    const rooms = rowsToObjects<Room>(rows);
    
    const processed = rooms
      .map((room) => ({
        Room_ID: room.room_id || "",
        Name: room.name || "",
        Description: room.description || "",
        Price_EUR: room.price_eur || "",
        Image_URL: convertDriveUrl(room.image_url || ""),
        iCal_URL: room.ical_url || "",
        Order: room.order || "0",
        Bookable: room.bookable || "yes",
        features: room.features ? room.features.split(",").map((f) => f.trim()) : [],
      }))
      .sort((a, b) => parseInt(a.Order) - parseInt(b.Order));

    return NextResponse.json(processed);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json([], { status: 500 });
  }
}
