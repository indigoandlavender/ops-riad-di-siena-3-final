"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Room {
  Room_ID: string;
  Name: string;
  Price_EUR: string;
  property: string;
}

const BOOKING_SOURCES = [
  { value: "booking", label: "Booking.com" },
  { value: "airbnb", label: "Airbnb" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "walkin", label: "Walk-in" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

export default function AddReservationPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    property: "",
    room: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    checkIn: "",
    checkOut: "",
    guests: 1,
    total: 0,
    source: "booking",
    notes: "",
    paypalStatus: "COMPLETED", // Manual reservations are usually already paid
  });

  useEffect(() => {
    // Fetch all rooms from both properties
    Promise.all([
      fetch("/api/rooms").then((r) => r.json()),
      fetch("/api/douaria-rooms").then((r) => r.json()),
    ])
      .then(([riadRooms, douariaRooms]) => {
        const allRooms = [
          ...riadRooms.map((r: Room) => ({ ...r, property: "riad" })),
          ...douariaRooms.map((r: Room) => ({ ...r, property: "douaria" })),
        ];
        setRooms(allRooms);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleRoomChange = (roomId: string) => {
    const selectedRoom = rooms.find((r) => r.Room_ID === roomId);
    if (selectedRoom) {
      setFormData({
        ...formData,
        room: selectedRoom.Name,
        property: selectedRoom.property,
      });
    }
  };

  const calculateTotal = () => {
    if (!formData.checkIn || !formData.checkOut) return 0;
    const selectedRoom = rooms.find((r) => r.Name === formData.room);
    if (!selectedRoom) return 0;

    const checkIn = new Date(formData.checkIn);
    const checkOut = new Date(formData.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) return 0;
    return nights * parseFloat(selectedRoom.Price_EUR);
  };

  useEffect(() => {
    const total = calculateTotal();
    if (total > 0 && formData.total === 0) {
      setFormData((prev) => ({ ...prev, total }));
    }
  }, [formData.checkIn, formData.checkOut, formData.room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          Booking_ID: `MANUAL-${Date.now()}`,
          Timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save reservation");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin/bookings");
      }, 1500);
    } catch (err) {
      setError("Failed to save reservation. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/10 border-t-black/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="font-serif text-[22px] text-black">Reservation Added</p>
          <p className="text-[13px] text-black/50 mt-2">Redirecting to bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="border-b border-black/[0.06] py-5 px-6">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/bookings"
              className="text-[13px] text-black/50 hover:text-black transition-colors"
            >
              ← Back
            </Link>
            <h1 className="font-serif text-[22px] text-black">Add Reservation</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="bg-white rounded-lg border border-black/[0.06] p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Booking Source */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                Booking Source
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
              >
                {BOOKING_SOURCES.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Selection */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                Room *
              </label>
              <select
                required
                value={rooms.find((r) => r.Name === formData.room)?.Room_ID || ""}
                onChange={(e) => handleRoomChange(e.target.value)}
                className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
              >
                <option value="">Select a room...</option>
                <optgroup label="The Riad">
                  {rooms.filter((r) => r.property === "riad").map((room) => (
                    <option key={room.Room_ID} value={room.Room_ID}>
                      {room.Name} (€{room.Price_EUR}/night)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="The Douaria">
                  {rooms.filter((r) => r.property === "douaria").map((room) => (
                    <option key={room.Room_ID} value={room.Room_ID}>
                      {room.Name} (€{room.Price_EUR}/night)
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Guest Details */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                  Check-in *
                </label>
                <input
                  type="date"
                  required
                  value={formData.checkIn}
                  onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                  Check-out *
                </label>
                <input
                  type="date"
                  required
                  value={formData.checkOut}
                  onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Guests & Total */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                  Guests
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.guests}
                  onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                  Total (€) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.total}
                  onChange={(e) => setFormData({ ...formData, total: parseFloat(e.target.value) })}
                  className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
                />
                {calculateTotal() > 0 && formData.total !== calculateTotal() && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, total: calculateTotal() })}
                    className="text-[11px] text-black/50 hover:text-black mt-2"
                  >
                    Suggested: €{calculateTotal()} (click to apply)
                  </button>
                )}
              </div>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                Payment Status
              </label>
              <select
                value={formData.paypalStatus}
                onChange={(e) => setFormData({ ...formData, paypalStatus: e.target.value })}
                className="w-full bg-transparent border-b border-black/20 pb-2 text-[13px] focus:outline-none focus:border-black"
              >
                <option value="COMPLETED">Paid</option>
                <option value="PENDING">Pending Payment</option>
                <option value="PARTIAL">Partial Payment</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.08em] text-black/40 mb-2">
                Notes
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-transparent border border-black/10 rounded-lg px-4 py-3 text-[13px] focus:outline-none focus:border-black/30 resize-none"
                placeholder="Any special requests, booking reference numbers, etc."
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-[13px]">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-black text-white py-3 text-[11px] uppercase tracking-[0.08em] font-semibold rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Add Reservation"}
              </button>
              <Link
                href="/admin/bookings"
                className="px-8 py-3 border border-black rounded-lg text-[11px] uppercase tracking-[0.08em] font-semibold hover:bg-black hover:text-white transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
