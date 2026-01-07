import { NextResponse } from "next/server";
import { getSheetData, rowsToObjects, updateSheetRow, deleteRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// PUT - Update an existing booking
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const { rowIndex } = data;

    if (rowIndex === undefined || rowIndex === null) {
      return NextResponse.json({ error: "Missing rowIndex" }, { status: 400 });
    }

    // Get current row data to preserve unchanged fields
    const rows = await getSheetData("Master_Guests");
    const currentRow = rows[rowIndex + 1]; // +1 for header

    if (!currentRow) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Build updated row (29 columns)
    // Column order: booking_id, source, status, first_name, last_name, email, phone, country,
    //               language, property, room, check_in, check_out, nights, guests, adults, children,
    //               total_eur, city_tax, special_requests, arrival_time_stated, arrival_request_sent,
    //               arrival_confirmed, arrival_time_confirmed, read_messages, midstay_checkin,
    //               notes, created_at, updated_at
    const updatedRow = [
      currentRow[0] || "",                                    // 1. booking_id (preserve)
      data.source || currentRow[1] || "",                     // 2. source
      data.status || currentRow[2] || "",                     // 3. status
      data.first_name || data.firstName || currentRow[3] || "", // 4. first_name
      data.last_name || data.lastName || currentRow[4] || "",   // 5. last_name
      data.email || currentRow[5] || "",                      // 6. email
      data.phone || currentRow[6] || "",                      // 7. phone
      data.country !== undefined ? data.country : (currentRow[7] || ""), // 8. country
      data.language !== undefined ? data.language : (currentRow[8] || ""), // 9. language
      data.property || currentRow[9] || "",                   // 10. property
      data.room || currentRow[10] || "",                      // 11. room
      data.check_in || data.checkIn || currentRow[11] || "",  // 12. check_in
      data.check_out || data.checkOut || currentRow[12] || "", // 13. check_out
      data.nights || currentRow[13] || "",                    // 14. nights
      currentRow[14] || "",                                   // 15. guests (preserve)
      currentRow[15] || "",                                   // 16. adults (preserve)
      currentRow[16] || "",                                   // 17. children (preserve)
      currentRow[17] || "",                                   // 18. total_eur (preserve)
      currentRow[18] || "",                                   // 19. city_tax (preserve)
      currentRow[19] || "",                                   // 20. special_requests (preserve)
      currentRow[20] || "",                                   // 21. arrival_time_stated (preserve)
      currentRow[21] || "",                                   // 22. arrival_request_sent (preserve)
      currentRow[22] || "",                                   // 23. arrival_confirmed (preserve)
      currentRow[23] || "",                                   // 24. arrival_time_confirmed (preserve)
      currentRow[24] || "",                                   // 25. read_messages (preserve)
      currentRow[25] || "",                                   // 26. midstay_checkin (preserve)
      data.notes !== undefined ? data.notes : (currentRow[26] || ""), // 27. notes
      currentRow[27] || "",                                   // 28. created_at (preserve)
      new Date().toISOString(),                               // 29. updated_at
    ];

    await updateSheetRow("Master_Guests", rowIndex, updatedRow);

    return NextResponse.json({ success: true, booking_id: params.id });
  } catch (error) {
    console.error("Failed to update booking:", error);
    return NextResponse.json(
      { error: "Failed to update booking", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a booking
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const { rowIndex } = data;

    if (rowIndex === undefined || rowIndex === null) {
      return NextResponse.json({ error: "Missing rowIndex" }, { status: 400 });
    }

    await deleteRow("Master_Guests", rowIndex);

    return NextResponse.json({ success: true, deleted_id: params.id });
  } catch (error) {
    console.error("Failed to delete booking:", error);
    return NextResponse.json(
      { error: "Failed to delete booking", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
