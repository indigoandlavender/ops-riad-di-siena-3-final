"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => {
        render: (selector: string) => Promise<void>;
        close: () => void;
      };
    };
  }
}

interface BookingDetails {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  room: string;
  property: string;
  nights: number;
  guests: number;
  cityTax: number;
  taxPaid: boolean;
}

function TaxPaymentContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id") || "";
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const paypalRef = useRef<HTMLDivElement>(null);
  const buttonsRendered = useRef(false);

  // Fetch booking details
  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    
    fetch(`/api/tax/booking?id=${bookingId}`)
      .then(res => res.json())
      .then(data => {
        if (data.booking) {
          setBooking(data.booking);
          if (data.booking.taxPaid) {
            setPaid(true);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [bookingId]);

  // Load PayPal script and render buttons
  useEffect(() => {
    if (!booking || paid || buttonsRendered.current) return;

    const PAYPAL_CLIENT_ID = "AWVf28iPmlVmaEyibiwkOtdXAl5UPqL9i8ee9yStaG6qb7hCwNRB2G95SYwbcikLnBox6CGyO-boyAvu";
    
    const loadPayPal = () => {
      if (window.paypal && paypalRef.current) {
        buttonsRendered.current = true;
        window.paypal.Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "pay",
          },
          createOrder: (_data: unknown, actions: { order: { create: (config: Record<string, unknown>) => Promise<string> } }) => {
            return actions.order.create({
              purchase_units: [{
                description: `City Tax - ${booking.guestName} - ${booking.id}`,
                amount: {
                  value: booking.cityTax.toFixed(2),
                  currency_code: "EUR",
                },
              }],
            });
          },
          onApprove: async (_data: unknown, actions: { order: { capture: () => Promise<unknown> } }) => {
            await actions.order.capture();
            // Record payment
            await fetch("/api/tax/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bookingId: booking.id }),
            });
            setPaid(true);
          },
          onError: (err: unknown) => {
            console.error("PayPal error:", err);
            setError("Payment failed. Please try again.");
          },
        }).render("#paypal-button-container");
      }
    };

    // Check if script already loaded
    if (window.paypal) {
      loadPayPal();
      return;
    }

    // Load PayPal script
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=EUR`;
    script.async = true;
    script.onload = loadPayPal;
    document.body.appendChild(script);

    return () => {
      buttonsRendered.current = false;
    };
  }, [booking, paid]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="animate-pulse text-black/40">Loading...</div>
      </div>
    );
  }

  // No booking ID
  if (!bookingId) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-black/60">No booking ID provided.</p>
        </div>
      </div>
    );
  }

  // Booking not found
  if (!booking) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-black/60">Booking not found.</p>
        </div>
      </div>
    );
  }

  // Already paid
  if (paid) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-black/90 mb-2">Payment Complete</h1>
          <p className="text-black/60 text-sm">
            Thank you! Your city tax has been paid.
          </p>
          <div className="mt-6 pt-6 border-t border-black/10">
            <p className="text-[12px] text-black/40">
              {booking.guestName} • €{booking.cityTax.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-2xl text-black/90 mb-2">City Tax Payment</h1>
          <p className="text-sm text-black/50">Riad di Siena</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          {/* Booking Info */}
          <div className="p-6 border-b border-black/5">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-black/40 mb-1">Guest</p>
                <p className="text-[15px] font-medium text-black/80">{booking.guestName}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-black/40 mb-1">Check-In</p>
                  <p className="text-[13px] text-black/70">{formatDate(booking.checkIn)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-black/40 mb-1">Check-Out</p>
                  <p className="text-[13px] text-black/70">{formatDate(booking.checkOut)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-black/40 mb-1">Nights</p>
                  <p className="text-[13px] text-black/70">{booking.nights}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-black/40 mb-1">Guests</p>
                  <p className="text-[13px] text-black/70">{booking.guests}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tax Calculation */}
          <div className="p-6 bg-amber-50/50">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-amber-800/70 font-medium">City Tax</p>
                <p className="text-[12px] text-amber-700/60 mt-0.5">
                  €2.50 × {booking.nights} {booking.nights === 1 ? "night" : "nights"} × {booking.guests} {booking.guests === 1 ? "guest" : "guests"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-amber-900">€{booking.cityTax.toFixed(2)}</p>
              </div>
            </div>
            
            <p className="text-[11px] text-amber-700/50 leading-relaxed">
              Required by Moroccan law for all guests staying in registered accommodations.
            </p>
          </div>

          {/* PayPal Button */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-[12px] text-red-700">{error}</p>
              </div>
            )}
            <div id="paypal-button-container" ref={paypalRef} className="min-h-[150px]" />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-black/30 mt-6">
          Secure payment powered by PayPal
        </p>
      </div>
    </div>
  );
}

export default function TaxPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="animate-pulse text-black/40">Loading...</div>
      </div>
    }>
      <TaxPaymentContent />
    </Suspense>
  );
}
