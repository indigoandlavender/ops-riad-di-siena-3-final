import { NextResponse } from "next/server";
import { getAllGuests } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const guests = await getAllGuests();

    const results = guests
      .filter((g) => {
        const searchable = `${g.booking_id} ${g.first_name} ${g.last_name} ${g.email} ${g.phone} ${g.country} ${g.room} ${g.property}`.toLowerCase();
        return searchable.includes(query);
      })
      .slice(0, 20)
      .map((g) => ({
        id: g.id,
        booking_id: g.booking_id,
        name: `${g.first_name || ""} ${g.last_name || ""}`.trim(),
        email: g.email,
        phone: g.phone,
        property: g.property,
        room: g.room,
        checkIn: g.check_in,
        checkOut: g.check_out,
        status: g.status,
        source: g.source,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
  }
}
