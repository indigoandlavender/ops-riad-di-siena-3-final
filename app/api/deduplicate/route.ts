import { NextResponse } from "next/server";
import { supabase, getAllGuests, MasterGuest } from "@/lib/supabase";

export async function POST() {
  try {
    const guests = await getAllGuests();

    // Find duplicates by booking_id
    const seen = new Map<string, MasterGuest>();
    const duplicateIds: number[] = [];

    for (const guest of guests) {
      if (!guest.booking_id || !guest.id) continue;

      const key = guest.booking_id.trim();
      if (seen.has(key)) {
        // Keep the one with more data or more recent updated_at
        const existing = seen.get(key)!;
        const existingDate = new Date(existing.updated_at || existing.created_at || "2000-01-01");
        const currentDate = new Date(guest.updated_at || guest.created_at || "2000-01-01");

        if (currentDate > existingDate) {
          // Current is newer, remove old
          duplicateIds.push(existing.id!);
          seen.set(key, guest);
        } else {
          // Existing is newer, remove current
          duplicateIds.push(guest.id);
        }
      } else {
        seen.set(key, guest);
      }
    }

    // Delete duplicates
    if (duplicateIds.length > 0) {
      const { error } = await supabase
        .from("master_guests")
        .delete()
        .in("id", duplicateIds);

      if (error) throw new Error(`Delete failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      duplicatesRemoved: duplicateIds.length,
      totalRemaining: guests.length - duplicateIds.length,
    });
  } catch (error) {
    console.error("Deduplicate error:", error);
    return NextResponse.json({ error: "Deduplication failed" }, { status: 500 });
  }
}
