"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface Booking {
  Booking_ID: string;
  property?: string;
  room?: string;
  tent?: string;
  experience?: string;
  firstName: string;
  lastName: string;
  email: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
  total: number;
  paypalStatus?: string;
  Timestamp?: string;
}

interface DashboardStats {
  newBookings: number;
  confirmed: number;
  totalBookings: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    newBookings: 0,
    confirmed: 0,
    totalBookings: 0,
    totalRevenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/bookings")
      .then((r) => r.json())
      .then((data) => {
        const bookings = data.bookings || [];
        const confirmed = bookings.filter((b: Booking) => b.paypalStatus === "COMPLETED");
        const revenue = confirmed.reduce((sum: number, b: Booking) => sum + (b.total || 0), 0);
        
        setStats({
          newBookings: bookings.filter((b: Booking) => !b.paypalStatus || b.paypalStatus === "PENDING").length,
          confirmed: confirmed.length,
          totalBookings: bookings.length,
          totalRevenue: revenue,
        });
        setRecentBookings(bookings.slice(0, 5));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getPropertyName = (booking: Booking): string => {
    if (booking.property) return booking.property;
    if (booking.room) return "The Riad";
    return "Unknown";
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="border-b border-black/[0.06] py-5 px-6">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mb-1">Riad di Siena</p>
            <h1 className="font-serif text-[22px] text-black">Admin Dashboard</h1>
          </div>
          <a
            href="https://riaddisiena.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-black/50 hover:text-black transition-colors"
          >
            View Site →
          </a>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-4xl">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-6 mb-12">
              <div className="text-center bg-white rounded-lg border border-black/[0.06] p-5">
                <p className="text-[28px] font-serif text-black">{stats.newBookings}</p>
                <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">Pending</p>
              </div>
              <div className="text-center bg-white rounded-lg border border-black/[0.06] p-5">
                <p className="text-[28px] font-serif text-black">{stats.confirmed}</p>
                <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">Confirmed</p>
              </div>
              <div className="text-center bg-white rounded-lg border border-black/[0.06] p-5">
                <p className="text-[28px] font-serif text-black">{stats.totalBookings}</p>
                <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">Total</p>
              </div>
              <div className="text-center bg-white rounded-lg border border-black/[0.06] p-5">
                <p className="text-[28px] font-serif text-black">€{stats.totalRevenue.toLocaleString()}</p>
                <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">Revenue</p>
              </div>
            </div>

            {/* Primary Tools */}
            <div className="space-y-3 mb-14">
              <Link
                href="/admin/calendar"
                className="block p-6 bg-white rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors"
              >
                <h2 className="font-serif text-[18px] text-black mb-1">Calendar</h2>
                <p className="text-[13px] text-black/50">
                  Visual overview of room availability across The Riad and The Douaria
                </p>
              </Link>
              <Link
                href="/admin/bookings"
                className="block p-6 bg-white rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors"
              >
                <h2 className="font-serif text-[18px] text-black mb-1">All Bookings</h2>
                <p className="text-[13px] text-black/50">
                  View and manage all reservations across properties
                </p>
              </Link>
              <Link
                href="/admin/reservations/new"
                className="block p-6 bg-white rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors"
              >
                <h2 className="font-serif text-[18px] text-black mb-1">Add Reservation</h2>
                <p className="text-[13px] text-black/50">
                  Manually add bookings from Booking.com, Airbnb, WhatsApp, etc.
                </p>
              </Link>
            </div>

            {/* Recent Bookings */}
            {recentBookings.length > 0 && (
              <div className="border-t border-black/[0.06] pt-10">
                <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-black/40 mb-5">Recent Bookings</p>
                <div className="space-y-2">
                  {recentBookings.map((booking) => (
                    <div 
                      key={booking.Booking_ID} 
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-black/[0.06] hover:border-black/15 transition-colors"
                    >
                      <div>
                        <p className="text-[15px] font-medium text-black">{booking.firstName} {booking.lastName}</p>
                        <p className="text-[13px] text-black/50">
                          {getPropertyName(booking)} · {booking.room || booking.tent || booking.experience}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] text-black/70">{formatDate(booking.checkIn || "")} → {formatDate(booking.checkOut || "")}</p>
                        <p className="text-[13px] text-black/40">€{booking.total}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link 
                  href="/admin/bookings" 
                  className="block text-center text-[13px] text-black/40 hover:text-black mt-4"
                >
                  View all →
                </Link>
              </div>
            )}

            {/* Property Quick Links */}
            <div className="border-t border-black/[0.06] pt-10 mt-10">
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-black/40 mb-5">Filter by Property</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  href="/admin/bookings?property=riad"
                  className="p-4 bg-white rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors text-center"
                >
                  <p className="text-[13px] text-black">The Riad</p>
                </Link>
                <Link
                  href="/admin/bookings?property=douaria"
                  className="p-4 bg-white rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors text-center"
                >
                  <p className="text-[13px] text-black">The Douaria</p>
                </Link>
                <Link
                  href="/admin/bookings?property=kasbah"
                  className="p-4 bg-white rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors text-center"
                >
                  <p className="text-[13px] text-black">The Kasbah</p>
                </Link>
                <Link
                  href="/admin/bookings?property=desert"
                  className="p-4 bg-white rounded-lg border border-black/[0.06] hover:border-black/20 transition-colors text-center"
                >
                  <p className="text-[13px] text-black">Desert Camp</p>
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
