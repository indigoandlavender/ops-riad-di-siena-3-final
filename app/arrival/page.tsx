"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface BookingDetails {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  room: string;
  arrivalTime: string;
}

function ArrivalFormContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id") || "";
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [arrivalTime, setArrivalTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Fetch booking details from API
  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    
    fetch(`/api/arrival/booking?id=${bookingId}`)
      .then(res => res.json())
      .then(data => {
        if (data.booking) {
          setBooking(data.booking);
          // If already submitted, show that
          if (data.booking.arrivalTime) {
            setSubmitted(true);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [bookingId]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arrivalTime) {
      setError("Please select your arrival time");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      const res = await fetch("/api/arrival/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          arrivalTime,
        }),
      });
      
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit. Please try again.");
      }
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="w-5 h-5 border border-[#1a1a1a]/20 border-t-[#1a1a1a]/60 rounded-full animate-spin" />
      </div>
    );
  }

  // Invalid link state
  if (!bookingId || !booking) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col">
        <header className="py-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#1a1a1a]/40 mb-2">
            Riad di Siena
          </p>
        </header>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <h1 className="font-serif text-[28px] text-[#1a1a1a]/90 mb-3">Invalid Link</h1>
            <p className="text-[14px] text-[#1a1a1a]/50 leading-relaxed">
              This link appears to be invalid or has expired.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col">
        <header className="py-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#1a1a1a]/40 mb-2">
            Riad di Siena
          </p>
        </header>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            {/* Checkmark */}
            <div className="w-16 h-16 border border-[#1a1a1a]/20 flex items-center justify-center mx-auto mb-8">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="font-serif text-[28px] text-[#1a1a1a]/90 mb-3">Thank You</h1>
            <p className="text-[14px] text-[#1a1a1a]/50 leading-relaxed mb-6">
              We've received your arrival time and our team will be ready to welcome you.
            </p>
            <p className="text-[12px] text-[#1a1a1a]/30">
              You may close this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-[#f8f5f0] flex flex-col">
      {/* Header */}
      <header className="py-8 text-center border-b border-[#1a1a1a]/10">
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#1a1a1a]/40 mb-2">
          Riad di Siena
        </p>
        <h1 className="font-serif text-[28px] text-[#1a1a1a]/90">Arrival Time</h1>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="max-w-sm mx-auto w-full">
          
          {/* Introduction */}
          <p className="text-[14px] text-[#1a1a1a]/50 leading-relaxed text-center mb-10">
            Please let us know when you'll be arriving so we can prepare for your welcome.
          </p>

          {/* Booking Details */}
          <div className="space-y-6 mb-10 pb-10 border-b border-[#1a1a1a]/10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#1a1a1a]/40 mb-1">Guest</p>
              <p className="text-[15px] text-[#1a1a1a]/90">{booking.guestName || "—"}</p>
            </div>
            
            {booking.room && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#1a1a1a]/40 mb-1">Room</p>
                <p className="text-[15px] text-[#1a1a1a]/90">{booking.room}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#1a1a1a]/40 mb-1">Check-in</p>
                <p className="text-[15px] text-[#1a1a1a]/90">{formatDate(booking.checkIn)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#1a1a1a]/40 mb-1">Check-out</p>
                <p className="text-[15px] text-[#1a1a1a]/90">{formatDate(booking.checkOut)}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Arrival Time Select */}
            <div className="mb-8">
              <label className="text-[10px] uppercase tracking-[0.15em] text-[#1a1a1a]/40 block mb-3">
                Expected Arrival Time
              </label>
              <select
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="w-full bg-transparent border-b border-[#1a1a1a]/20 pb-3 text-[15px] text-[#1a1a1a]/90 focus:outline-none focus:border-[#1a1a1a]/40 transition-colors cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%231a1a1a' stroke-opacity='0.4' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0 center',
                }}
              >
                <option value="">Select a time...</option>
                <option value="12:00">12:00 (Noon)</option>
                <option value="12:30">12:30</option>
                <option value="13:00">13:00</option>
                <option value="13:30">13:30</option>
                <option value="14:00">14:00</option>
                <option value="14:30">14:30</option>
                <option value="15:00">15:00 (Check-in opens)</option>
                <option value="15:30">15:30</option>
                <option value="16:00">16:00</option>
                <option value="16:30">16:30</option>
                <option value="17:00">17:00</option>
                <option value="17:30">17:30</option>
                <option value="18:00">18:00</option>
                <option value="18:30">18:30</option>
                <option value="19:00">19:00</option>
                <option value="19:30">19:30</option>
                <option value="20:00">20:00</option>
                <option value="20:30">20:30</option>
                <option value="21:00">21:00</option>
                <option value="21:30">21:30</option>
                <option value="22:00">22:00</option>
                <option value="22:30">22:30</option>
                <option value="23:00">23:00</option>
                <option value="late">Late arrival (after 23:00)</option>
              </select>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[13px] text-red-700/80 mb-6">{error}</p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1a1a1a] text-[#f8f5f0] py-4 text-[11px] uppercase tracking-[0.1em] font-medium hover:bg-[#1a1a1a]/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Confirm Arrival Time"}
            </button>
          </form>

          {/* Footer Note */}
          <p className="text-[12px] text-[#1a1a1a]/30 text-center mt-8">
            Check-in is from 15:00. Earlier arrivals may require luggage storage.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ArrivalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="w-5 h-5 border border-[#1a1a1a]/20 border-t-[#1a1a1a]/60 rounded-full animate-spin" />
      </div>
    }>
      <ArrivalFormContent />
    </Suspense>
  );
}
