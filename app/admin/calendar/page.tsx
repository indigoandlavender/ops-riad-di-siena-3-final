"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";

interface Booking {
  id: string;
  guestName: string;
  room: string;
  property: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  source: string;
  status: string;
}

interface Room {
  id: string;
  name: string;
  property: string;
}

const SOURCE_COLORS: Record<string, string> = {
  "Booking.com": "bg-[#89CFF0]", // Powder blue
  "Booking": "bg-[#89CFF0]",     // Powder blue (alternate)
  "booking.com": "bg-[#89CFF0]", // Powder blue (lowercase)
  "booking": "bg-[#89CFF0]",     // Powder blue (lowercase)
  "Airbnb": "bg-[#E8A9A9]",      // Brick red/rose
  "airbnb": "bg-[#E8A9A9]",      // Brick red (lowercase)
  "Direct": "bg-[#A3B18A]",      // Olive green
  "direct": "bg-[#A3B18A]",      // Olive green (lowercase)
};

const SOURCE_TEXT_COLORS: Record<string, string> = {
  "Booking.com": "text-[#1a4a6e]", // Dark blue text
  "Booking": "text-[#1a4a6e]",     // Dark blue text
  "booking.com": "text-[#1a4a6e]", // Dark blue text
  "booking": "text-[#1a4a6e]",     // Dark blue text
  "Airbnb": "text-[#6b3a3a]",      // Dark rose text
  "airbnb": "text-[#6b3a3a]",      // Dark rose text
  "Direct": "text-[#3a4a34]",      // Dark olive text
  "direct": "text-[#3a4a34]",      // Dark olive text
};

// Helper to get color with flexible matching
const getSourceColor = (source: string): string => {
  const s = (source || "").trim().toLowerCase();
  if (s.includes("blackout") || s.includes("blocked")) return "bg-[#4a4a4a]";  // Dark gray
  if (s.includes("airbnb")) return "bg-[#E8A9A9]";      // Brick red
  if (s.includes("direct")) return "bg-[#A3B18A]";      // Olive green
  return "bg-[#89CFF0]";                                 // Default: Powder blue (Booking.com)
};

const getSourceTextColor = (source: string): string => {
  const s = (source || "").trim().toLowerCase();
  if (s.includes("blackout") || s.includes("blocked")) return "text-white/70"; // Light text
  if (s.includes("airbnb")) return "text-[#6b3a3a]";    // Dark rose
  if (s.includes("direct")) return "text-[#3a4a34]";    // Dark olive
  return "text-[#1a4a6e]";                               // Default: Dark blue
};

// Parse individual room names from a booking (handles "Bliss / Joy / Hidden Gem")
const parseRoomNames = (roomStr: string): string[] => {
  if (!roomStr) return [];
  // Split by "/" or "+" and trim whitespace
  return roomStr.split(/[\/\+]/).map(r => r.trim()).filter(Boolean);
};

// Canonical room list for The Riad and The Douaria
const RIAD_ROOMS = ["Hidden Gem", "Jewel Box", "Trésor Caché"];
const DOUARIA_ROOMS = ["Bliss", "Joy", "Love"];

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 3);
    return today;
  });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newBooking, setNewBooking] = useState<{room: string; date: string} | null>(null);
  const [newBookingForm, setNewBookingForm] = useState({
    firstName: "",
    lastName: "",
    checkIn: "",
    checkOut: "",
    email: "",
    phone: "",
    source: "Direct",
    room: "",
    isBlackout: false,
  });
  const [savingBooking, setSavingBooking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const DAYS_TO_SHOW = 42;

  const dates = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [startDate]);

  // Fetch bookings and use canonical rooms
  useEffect(() => {
    // Add timestamp to bust cache
    fetch(`/api/admin/bookings?_t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        
        const allBookings = (data.bookings || []).map((b: any) => ({
          id: b.Booking_ID || b.booking_id,
          guestName: [b.firstName || b.first_name, b.lastName || b.last_name].filter(Boolean).join(" "),
          room: b.room || "",
          property: b.property || "The Riad",
          checkIn: b.checkIn || b.check_in,
          checkOut: b.checkOut || b.check_out,
          nights: parseInt(b.nights || "1", 10),
          source: b.source || "Direct",
          status: b.status || "",
        }));

        // Deduplicate bookings
        const bookingMap = new Map<string, Booking>();
        for (const b of allBookings) {
          if (b.id) bookingMap.set(b.id, b);
        }
        const deduped = Array.from(bookingMap.values());

        // Filter out cancelled
        const filtered = deduped.filter((b: Booking) => {
          const s = (b.status || "").toLowerCase();
          return s !== "cancelled" && s !== "canceled";
        });

        setBookings(filtered);

        // Use canonical room list instead of extracting from bookings
        const roomList: Room[] = [
          ...RIAD_ROOMS.map(name => ({
            id: name.toLowerCase().replace(/\s+/g, "-"),
            name,
            property: "The Riad",
          })),
          ...DOUARIA_ROOMS.map(name => ({
            id: name.toLowerCase().replace(/\s+/g, "-"),
            name,
            property: "The Douaria",
          })),
        ];

        setRooms(roomList);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Failed to fetch bookings:", e);
        setLoading(false);
      });
  }, []);

  // Scroll to today
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const todayIndex = dates.findIndex((d) => isToday(d));
      if (todayIndex > 0) {
        scrollRef.current.scrollLeft = Math.max(0, (todayIndex - 2) * 48);
      }
    }
  }, [loading, dates]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short" });
  };

  const getBookingForCell = (room: Room, date: Date): Booking | null => {
    const dateStr = date.toISOString().split("T")[0];
    
    const found = bookings.find((b) => {
      // Check if this booking includes this room (handles bundles like "Bliss / Joy")
      const bookingRooms = parseRoomNames(b.room);
      const roomMatches = bookingRooms.some(br => 
        br.toLowerCase() === room.name.toLowerCase() ||
        room.name.toLowerCase().includes(br.toLowerCase()) ||
        br.toLowerCase().includes(room.name.toLowerCase())
      );
      
      if (!roomMatches) return false;
      if (!b.checkIn || !b.checkOut) return false;
      
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      const current = new Date(dateStr);
      
      return current >= checkIn && current < checkOut;
    }) || null;
    
    return found;
  };

  const isBookingStart = (room: Room, date: Date, booking: Booking): boolean => {
    const checkIn = new Date(booking.checkIn);
    return date.toDateString() === checkIn.toDateString();
  };

  const getBookingSpan = (booking: Booking, startCellDate: Date): number => {
    const checkOut = new Date(booking.checkOut);
    const endDate = dates[dates.length - 1];
    const visibleEnd = checkOut > endDate ? endDate : checkOut;
    const diffTime = visibleEnd.getTime() - startCellDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  };

  const goBack = () => {
    const newStart = new Date(startDate);
    newStart.setDate(newStart.getDate() - 14);
    setStartDate(newStart);
  };

  const goForward = () => {
    const newStart = new Date(startDate);
    newStart.setDate(newStart.getDate() + 14);
    setStartDate(newStart);
  };

  const goToToday = () => {
    const today = new Date();
    today.setDate(today.getDate() - 3);
    setStartDate(today);
  };

  // Handle clicking an empty cell
  const handleEmptyCellClick = (room: Room, date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    setNewBooking({ room: room.name, date: dateStr });
    setNewBookingForm({
      firstName: "",
      lastName: "",
      checkIn: dateStr,
      checkOut: (() => {
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        return next.toISOString().split("T")[0];
      })(),
      email: "",
      phone: "",
      source: "Direct",
      room: room.name,
      isBlackout: false,
    });
  };

  // Save new booking (direct or blackout)
  const saveNewBooking = async () => {
    if (!newBooking) return;
    
    // Validation - blackouts need less info
    if (newBookingForm.isBlackout) {
      if (!newBookingForm.checkIn || !newBookingForm.checkOut) return;
    } else {
      if (!newBookingForm.firstName || !newBookingForm.checkIn || !newBookingForm.checkOut || !newBookingForm.phone) return;
    }
    
    // Use the room from form (can be changed)
    const selectedRoom = newBookingForm.room || newBooking.room;
    
    // Determine property based on room
    const property = RIAD_ROOMS.includes(selectedRoom) ? "The Riad" : "The Douaria";
    
    // Calculate nights
    const checkIn = new Date(newBookingForm.checkIn);
    const checkOut = new Date(newBookingForm.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    setSavingBooking(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: selectedRoom,
          property: property,
          firstName: newBookingForm.isBlackout ? "BLOCKED" : newBookingForm.firstName,
          lastName: newBookingForm.isBlackout ? "" : newBookingForm.lastName,
          check_in: newBookingForm.checkIn,
          check_out: newBookingForm.checkOut,
          nights: nights.toString(),
          email: newBookingForm.email,
          phone: newBookingForm.phone,
          source: newBookingForm.isBlackout ? "Blackout" : newBookingForm.source,
          status: newBookingForm.isBlackout ? "blocked" : "confirmed",
        }),
      });

      if (res.ok) {
        // Refresh bookings
        const data = await fetch("/api/admin/bookings").then(r => r.json());
        const allBookings = (data.bookings || []).map((b: any) => ({
          id: b.Booking_ID || b.booking_id,
          guestName: [b.firstName || b.first_name, b.lastName || b.last_name].filter(Boolean).join(" ") || "BLOCKED",
          room: b.room || "",
          property: b.property || "The Riad",
          checkIn: b.checkIn || b.check_in,
          checkOut: b.checkOut || b.check_out,
          nights: parseInt(b.nights || "1", 10),
          source: b.source || "Direct",
          status: b.status || "",
        }));
        const bookingMap = new Map<string, Booking>();
        for (const b of allBookings) {
          if (b.id) bookingMap.set(b.id, b);
        }
        const filtered = Array.from(bookingMap.values()).filter((b: Booking) => {
          const s = (b.status || "").toLowerCase();
          return s !== "cancelled" && s !== "canceled";
        });
        setBookings(filtered);
        setNewBooking(null);
      }
    } catch (e) {
      console.error("Error saving booking:", e);
    } finally {
      setSavingBooking(false);
    }
  };

  // Group rooms by property
  const riadRooms = rooms.filter((r) => r.property === "The Riad");
  const douariaRooms = rooms.filter((r) => r.property === "The Douaria");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-black">
      <header className="border-b border-black/[0.06] py-5 px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mb-1">Admin</p>
            <h1 className="font-serif text-[22px] text-black">Availability</h1>
          </div>
          <Link href="/admin" className="text-[11px] uppercase tracking-[0.08em] font-semibold text-black/40 hover:text-black transition-colors">
            ← Back
          </Link>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="px-3 py-2 rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors text-[13px] text-black/70">
              ← 2 weeks
            </button>
            <button onClick={goToToday} className="px-3 py-2 rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors text-[13px] text-black/70">
              Today
            </button>
            <button onClick={goForward} className="px-3 py-2 rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors text-[13px] text-black/70">
              2 weeks →
            </button>
            <button 
              onClick={() => {
                setLoading(true);
                fetch(`/api/admin/bookings?_t=${Date.now()}`, { cache: 'no-store' })
                  .then((r) => r.json())
                  .then((data) => {
                    const allBookings = (data.bookings || []).map((b: any) => ({
                      id: b.Booking_ID || b.booking_id,
                      guestName: [b.firstName || b.first_name, b.lastName || b.last_name].filter(Boolean).join(" "),
                      room: b.room || "",
                      property: b.property || "The Riad",
                      checkIn: b.checkIn || b.check_in,
                      checkOut: b.checkOut || b.check_out,
                      nights: parseInt(b.nights || "1", 10),
                      source: b.source || "Direct",
                      status: b.status || "",
                    }));
                    const bookingMap = new Map<string, Booking>();
                    for (const b of allBookings) {
                      if (b.id) bookingMap.set(b.id, b);
                    }
                    const filtered = Array.from(bookingMap.values()).filter((b: Booking) => {
                      const s = (b.status || "").toLowerCase();
                      return s !== "cancelled" && s !== "canceled";
                    });
                    setBookings(filtered);
                    setLoading(false);
                  })
                  .catch(() => setLoading(false));
              }} 
              className="px-3 py-2 rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors text-[13px] text-black/70"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#89CFF0]" />
              <span className="text-black/50">Booking.com</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#E8A9A9]" />
              <span className="text-black/50">Airbnb</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#A3B18A]" />
              <span className="text-black/50">Direct</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#4a4a4a]" />
              <span className="text-black/50">Blocked</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-black/[0.06] rounded-lg overflow-hidden">
          <div className="flex">
            {/* Room Labels */}
            <div className="flex-shrink-0 w-40 border-r border-black/[0.06]">
              <div className="h-8 border-b border-black/[0.06]" />
              <div className="h-12 border-b border-black/[0.06]" />

              {riadRooms.length > 0 && (
                <>
                  <div className="h-8 bg-black/[0.02] border-b border-black/[0.06] flex items-center px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/40">The Riad</span>
                  </div>
                  {riadRooms.map((room) => (
                    <div key={room.id} className="h-12 border-b border-black/[0.04] flex items-center px-3">
                      <span className="text-[13px] text-black/70 truncate">{room.name}</span>
                    </div>
                  ))}
                </>
              )}

              {douariaRooms.length > 0 && (
                <>
                  <div className="h-8 bg-black/[0.02] border-b border-black/[0.06] flex items-center px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/40">The Douaria</span>
                  </div>
                  {douariaRooms.map((room) => (
                    <div key={room.id} className="h-12 border-b border-black/[0.04] flex items-center px-3">
                      <span className="text-[13px] text-black/70 truncate">{room.name}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Calendar Grid */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto">
              {/* Month Row */}
              <div className="flex h-8 border-b border-black/[0.06] sticky top-0 bg-white">
                {dates.map((date, idx) => {
                  const showMonth = idx === 0 || date.getDate() === 1;
                  return (
                    <div key={idx} className="w-12 flex-shrink-0 flex items-center justify-center border-r border-black/[0.02]">
                      {showMonth && <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/40">{formatMonth(date)}</span>}
                    </div>
                  );
                })}
              </div>

              {/* Date Row */}
              <div className="flex h-12 border-b border-black/[0.06]">
                {dates.map((date, idx) => (
                  <div
                    key={idx}
                    className={`w-12 flex-shrink-0 flex flex-col items-center justify-center border-r border-black/[0.02] ${
                      isToday(date) ? "bg-amber-50" : isWeekend(date) ? "bg-black/[0.01]" : ""
                    }`}
                  >
                    <span className="text-[10px] text-black/30">{date.toLocaleDateString("en-US", { weekday: "short" }).charAt(0)}</span>
                    <span className={`text-[13px] ${isToday(date) ? "text-amber-600 font-semibold" : "text-black/70"}`}>{date.getDate()}</span>
                  </div>
                ))}
              </div>

              {/* The Riad */}
              {riadRooms.length > 0 && (
                <>
                  <div className="h-8 bg-black/[0.02] border-b border-black/[0.06]" />
                  {riadRooms.map((room) => (
                    <div key={room.id} className="flex h-12 border-b border-black/[0.04] relative">
                      {dates.map((date, idx) => {
                        const booking = getBookingForCell(room, date);
                        const isStart = booking && isBookingStart(room, date, booking);
                        const isEmpty = !booking;
                        return (
                          <div
                            key={idx}
                            onClick={() => isEmpty && handleEmptyCellClick(room, date)}
                            className={`w-12 flex-shrink-0 border-r border-black/[0.02] relative ${
                              isToday(date) ? "bg-amber-50/50" : isWeekend(date) ? "bg-black/[0.01]" : ""
                            } ${isEmpty ? "cursor-pointer hover:bg-black/[0.03]" : ""}`}
                          >
                            {isStart && booking && (
                              <button
                                onClick={() => setSelectedBooking(booking)}
                                className={`absolute top-1 left-0.5 h-10 rounded-sm flex items-center px-2 overflow-hidden z-10 hover:brightness-95 transition-all ${
                                  getSourceColor(booking.source)
                                }`}
                                style={{ width: `${getBookingSpan(booking, date) * 48 - 4}px` }}
                              >
                                <span className={`text-[11px] font-medium truncate ${getSourceTextColor(booking.source)}`}>{booking.guestName}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}

              {/* The Douaria */}
              {douariaRooms.length > 0 && (
                <>
                  <div className="h-8 bg-black/[0.02] border-b border-black/[0.06]" />
                  {douariaRooms.map((room) => (
                    <div key={room.id} className="flex h-12 border-b border-black/[0.04] relative">
                      {dates.map((date, idx) => {
                        const booking = getBookingForCell(room, date);
                        const isStart = booking && isBookingStart(room, date, booking);
                        const isEmpty = !booking;
                        return (
                          <div
                            key={idx}
                            onClick={() => isEmpty && handleEmptyCellClick(room, date)}
                            className={`w-12 flex-shrink-0 border-r border-black/[0.02] relative ${
                              isToday(date) ? "bg-amber-50/50" : isWeekend(date) ? "bg-black/[0.01]" : ""
                            } ${isEmpty ? "cursor-pointer hover:bg-black/[0.03]" : ""}`}
                          >
                            {isStart && booking && (
                              <button
                                onClick={() => setSelectedBooking(booking)}
                                className={`absolute top-1 left-0.5 h-10 rounded-sm flex items-center px-2 overflow-hidden z-10 hover:brightness-95 transition-all ${
                                  getSourceColor(booking.source)
                                }`}
                                style={{ width: `${getBookingSpan(booking, date) * 48 - 4}px` }}
                              >
                                <span className={`text-[11px] font-medium truncate ${getSourceTextColor(booking.source)}`}>{booking.guestName}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          {(() => {
            const today = new Date();
            const totalRooms = rooms.length;
            if (totalRooms === 0) return <div className="col-span-4 text-center text-black/50 py-8">No rooms found in bookings</div>;

            const occupiedToday = rooms.filter((room) => getBookingForCell(room, today)).length;
            let occupied7 = 0;
            for (let i = 0; i < 7; i++) {
              const d = new Date(today.getTime() + i * 86400000);
              occupied7 += rooms.filter((room) => getBookingForCell(room, d)).length;
            }
            let occupied30 = 0;
            for (let i = 0; i < 30; i++) {
              const d = new Date(today.getTime() + i * 86400000);
              occupied30 += rooms.filter((room) => getBookingForCell(room, d)).length;
            }

            return (
              <>
                <div className="bg-white border border-black/[0.06] rounded-lg p-4">
                  <p className="text-[28px] font-serif text-black">{occupiedToday}/{totalRooms}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">Occupied Tonight</p>
                </div>
                <div className="bg-white border border-black/[0.06] rounded-lg p-4">
                  <p className="text-[28px] font-serif text-black">{totalRooms - occupiedToday}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">Available Tonight</p>
                </div>
                <div className="bg-white border border-black/[0.06] rounded-lg p-4">
                  <p className="text-[28px] font-serif text-black">{Math.round((occupied7 / (totalRooms * 7)) * 100)}%</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">Next 7 Days</p>
                </div>
                <div className="bg-white border border-black/[0.06] rounded-lg p-4">
                  <p className="text-[28px] font-serif text-black">{Math.round((occupied30 / (totalRooms * 30)) * 100)}%</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">Next 30 Days</p>
                </div>
              </>
            );
          })()}
        </div>
      </main>

      {/* Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-lg max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-lg border-b border-black/[0.06] px-5 py-5 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-1 h-12 rounded-full ${getSourceColor(selectedBooking.source)}`} />
                <div>
                  <h3 className="font-serif text-[18px] text-black">{selectedBooking.guestName}</h3>
                  <p className="text-[13px] text-black/50">{selectedBooking.room}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-black/30 hover:text-black/60 transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <div className="flex justify-between py-2 border-b border-black/[0.04]">
                <span className="text-[10px] uppercase tracking-[0.08em] text-black/40">Check-in</span>
                <span className="text-[13px] text-black">{new Date(selectedBooking.checkIn).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-black/[0.04]">
                <span className="text-[10px] uppercase tracking-[0.08em] text-black/40">Check-out</span>
                <span className="text-[13px] text-black">{new Date(selectedBooking.checkOut).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-black/[0.04]">
                <span className="text-[10px] uppercase tracking-[0.08em] text-black/40">Nights</span>
                <span className="text-[13px] text-black">{selectedBooking.nights}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-black/[0.04]">
                <span className="text-[10px] uppercase tracking-[0.08em] text-black/40">Source</span>
                <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${
                  selectedBooking.source === "Booking.com" ? "bg-blue-50 text-blue-600" :
                  selectedBooking.source === "Airbnb" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                }`}>{selectedBooking.source}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 pb-5 flex gap-3">
              <Link href="/guests" className="flex-1 text-center text-[11px] uppercase tracking-[0.08em] font-semibold border border-black rounded-lg py-3 hover:bg-black hover:text-white transition-colors">
                Guest Dashboard
              </Link>
              <button onClick={() => setSelectedBooking(null)} className="flex-1 text-[11px] uppercase tracking-[0.08em] font-semibold bg-black text-white rounded-lg py-3 hover:bg-black/80 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Booking Modal */}
      {newBooking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setNewBooking(null)}>
          <div className="bg-white rounded-lg max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-lg border-b border-black/[0.06] px-5 py-5 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-1 h-12 rounded-full ${newBookingForm.isBlackout ? 'bg-[#4a4a4a]' : 'bg-[#A3B18A]'}`} />
                <div>
                  <h3 className="font-serif text-[18px] text-black">{newBookingForm.isBlackout ? 'Block Dates' : 'New Reservation'}</h3>
                  <p className="text-[13px] text-black/50">{newBookingForm.room || newBooking.room}</p>
                </div>
              </div>
              <button onClick={() => setNewBooking(null)} className="text-black/30 hover:text-black/60 transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-5">
              {/* Blackout Toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBookingForm.isBlackout}
                    onChange={(e) => setNewBookingForm({ ...newBookingForm, isBlackout: e.target.checked })}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-[13px] text-black/70">Block dates (no guest)</span>
                </label>
              </div>

              {/* Room Selection */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">Room *</label>
                <select
                  value={newBookingForm.room || newBooking.room}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, room: e.target.value })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                >
                  <optgroup label="The Riad">
                    {RIAD_ROOMS.map(room => (
                      <option key={room} value={room}>{room}</option>
                    ))}
                  </optgroup>
                  <optgroup label="The Douaria">
                    {DOUARIA_ROOMS.map(room => (
                      <option key={room} value={room}>{room}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Booking Source (hidden for blackouts) */}
              {!newBookingForm.isBlackout && (
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">Booking Source *</label>
                  <select
                    value={newBookingForm.source}
                    onChange={(e) => setNewBookingForm({ ...newBookingForm, source: e.target.value })}
                    className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                  >
                    <option value="Direct">Direct</option>
                    <option value="Booking.com">Booking.com</option>
                    <option value="Airbnb">Airbnb</option>
                  </select>
                </div>
              )}

              {/* Guest name (hidden for blackouts) */}
              {!newBookingForm.isBlackout && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={newBookingForm.firstName}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, firstName: e.target.value })}
                      className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                      placeholder="Guest first name"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">Last Name</label>
                    <input
                      type="text"
                      value={newBookingForm.lastName}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, lastName: e.target.value })}
                      className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                      placeholder="Guest last name"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">Check-in *</label>
                  <input
                    type="date"
                    value={newBookingForm.checkIn}
                    onChange={(e) => setNewBookingForm({ ...newBookingForm, checkIn: e.target.value })}
                    className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">Check-out *</label>
                  <input
                    type="date"
                    value={newBookingForm.checkOut}
                    onChange={(e) => setNewBookingForm({ ...newBookingForm, checkOut: e.target.value })}
                    className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Contact info (hidden for blackouts) */}
              {!newBookingForm.isBlackout && (
                <>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">Phone *</label>
                    <input
                      type="tel"
                      value={newBookingForm.phone}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, phone: e.target.value })}
                      className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                      placeholder="+1 234 567 8900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">Email</label>
                    <input
                      type="email"
                      value={newBookingForm.email}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, email: e.target.value })}
                      className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                      placeholder="guest@email.com"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 pb-5 flex gap-3">
              <button 
                onClick={() => setNewBooking(null)} 
                className="flex-1 text-[11px] uppercase tracking-[0.08em] font-semibold border border-black rounded-lg py-3 hover:bg-black hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveNewBooking}
                disabled={savingBooking || !newBookingForm.checkIn || !newBookingForm.checkOut || (!newBookingForm.isBlackout && (!newBookingForm.firstName || !newBookingForm.phone))}
                className={`flex-1 text-[11px] uppercase tracking-[0.08em] font-semibold rounded-lg py-3 disabled:opacity-50 transition-colors ${
                  newBookingForm.isBlackout 
                    ? 'bg-[#4a4a4a] text-white hover:bg-[#5a5a5a]' 
                    : 'bg-black text-white hover:bg-black/80'
                }`}
              >
                {savingBooking ? "Saving..." : newBookingForm.isBlackout ? "Block Dates" : "Add Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
