"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Guest {
  booking_id: string;
  guest_name: string;
  email: string;
  phone: string;
  country: string;
  property: string;
  room_type: string;
  check_in: string;
  check_out: string;
  nights: string;
  guests_count: string;
  stated_arrival_time: string;
  arrival_request_sent: string;
  arrival_confirmed: string;
  arrival_time_confirmed: string;
  notes: string;
  status: string;
}

type Tab = "today" | "need-action" | "next-7-days" | "all";

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchGuests();
  }, []);

  const fetchGuests = async () => {
    try {
      const res = await fetch("/api/guests");
      const data = await res.json();
      setGuests(data.guests || []);
    } catch (error) {
      console.error("Error fetching guests:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateGuest = async (bookingId: string, updates: Partial<Guest>) => {
    setUpdating(bookingId);
    try {
      const res = await fetch("/api/guests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, ...updates }),
      });

      if (res.ok) {
        const data = await res.json();
        setGuests((prev) =>
          prev.map((g) =>
            g.booking_id === bookingId ? { ...g, ...data.guest } : g
          )
        );
      }
    } catch (error) {
      console.error("Error updating guest:", error);
    } finally {
      setUpdating(null);
    }
  };

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const in4Days = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcomingGuests = guests
    .filter((g) => {
      const status = (g.status || "").toLowerCase();
      if (status === "cancelled" || status === "canceled") return false;
      return new Date(g.check_in) >= new Date(todayStr);
    })
    .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());

  const todayGuests = upcomingGuests.filter((g) => {
    const checkInStr = g.check_in.split("T")[0];
    return checkInStr === todayStr;
  });

  const needActionGuests = upcomingGuests.filter((g) => {
    const checkIn = new Date(g.check_in);
    return checkIn <= in4Days && g.arrival_confirmed !== "Yes";
  });

  const next7DaysGuests = upcomingGuests.filter(
    (g) => new Date(g.check_in) <= in7Days
  );

  const getFilteredGuests = () => {
    switch (activeTab) {
      case "today":
        return todayGuests;
      case "need-action":
        return needActionGuests;
      case "next-7-days":
        return next7DaysGuests;
      default:
        return upcomingGuests;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const checkIn = new Date(dateStr);
    const diff = Math.ceil((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getWhatsAppLink = (guest: Guest) => {
    const phone = guest.phone?.replace(/[^0-9+]/g, "") || "";
    const firstName = guest.guest_name?.split(" ")[0] || "Guest";
    const message = encodeURIComponent(
      `Hello ${firstName},\n\nWe're looking forward to welcoming you to ${guest.room_type || guest.property} on ${formatDate(guest.check_in)}.\n\nCould you please confirm your expected arrival time?\n\nThank you!`
    );
    return `https://wa.me/${phone.replace("+", "")}?text=${message}`;
  };

  const handleSendWhatsApp = (guest: Guest) => {
    window.open(getWhatsAppLink(guest), "_blank");
    updateGuest(guest.booking_id, {
      arrival_request_sent: new Date().toISOString(),
    });
  };

  const handleToggleConfirmed = (guest: Guest) => {
    const newValue = guest.arrival_confirmed === "Yes" ? "" : "Yes";
    updateGuest(guest.booking_id, { arrival_confirmed: newValue });
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="border-b border-black/[0.06] py-5 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[13px] font-medium text-black/40 hover:text-black transition-colors"
            >
              ← Back
            </Link>
            <div>
              <h1 className="font-serif text-[22px] font-medium tracking-[-0.01em] text-black">Guest Dashboard</h1>
              <p className="text-[13px] text-black/50 mt-0.5 font-medium">Track arrivals and confirmations</p>
            </div>
          </div>
          <Link
            href="/import"
            className="text-[13px] font-medium text-black/40 hover:text-black transition-colors"
          >
            Import Bookings →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-6 h-6 border-2 border-black/10 border-t-black/40 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-8 border-b border-black/[0.06]">
              <button
                onClick={() => setActiveTab("today")}
                className={`px-4 py-3 text-[13px] font-medium transition-colors relative ${
                  activeTab === "today"
                    ? "text-black"
                    : "text-black/40 hover:text-black/70"
                }`}
              >
                Today
                {todayGuests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full">
                    {todayGuests.length}
                  </span>
                )}
                {activeTab === "today" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("need-action")}
                className={`px-4 py-3 text-[13px] font-medium transition-colors relative ${
                  activeTab === "need-action"
                    ? "text-black"
                    : "text-black/40 hover:text-black/70"
                }`}
              >
                Need Action
                {needActionGuests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-700 text-[11px] font-semibold rounded-full">
                    {needActionGuests.length}
                  </span>
                )}
                {activeTab === "need-action" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("next-7-days")}
                className={`px-4 py-3 text-[13px] font-medium transition-colors relative ${
                  activeTab === "next-7-days"
                    ? "text-black"
                    : "text-black/40 hover:text-black/70"
                }`}
              >
                Next 7 Days
                <span className="ml-2 text-black/30">{next7DaysGuests.length}</span>
                {activeTab === "next-7-days" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-3 text-[13px] font-medium transition-colors relative ${
                  activeTab === "all"
                    ? "text-black"
                    : "text-black/40 hover:text-black/70"
                }`}
              >
                All Upcoming
                <span className="ml-2 text-black/30">{upcomingGuests.length}</span>
                {activeTab === "all" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                )}
              </button>
            </div>

            {/* Guest List */}
            <div className="space-y-3">
              {getFilteredGuests().length === 0 ? (
                <div className="text-center py-16 text-[14px] text-black/40">
                  {activeTab === "need-action" 
                    ? "No guests need action right now" 
                    : "No upcoming guests"}
                </div>
              ) : (
                getFilteredGuests().map((guest) => {
                  const daysUntil = getDaysUntil(guest.check_in);
                  const isUrgent = daysUntil <= 2 && guest.arrival_confirmed !== "Yes";
                  const needsAttention = daysUntil <= 4 && guest.arrival_confirmed !== "Yes";
                  const isConfirmed = guest.arrival_confirmed === "Yes";

                  return (
                    <div
                      key={guest.booking_id}
                      className={`p-5 bg-white border rounded-lg transition-all ${
                        isUrgent
                          ? "border-red-200 bg-red-50/50"
                          : isConfirmed
                          ? "border-emerald-200 bg-emerald-50/30"
                          : "border-black/[0.06]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <h3 className="text-[15px] font-semibold text-black truncate">{guest.guest_name || "Unknown Guest"}</h3>
                            {guest.country && (
                              <span className="text-[13px] text-black/40">{guest.country}</span>
                            )}
                            {needsAttention && !isConfirmed && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[11px] font-semibold rounded">
                                {daysUntil} day{daysUntil !== 1 ? "s" : ""}
                              </span>
                            )}
                            {isConfirmed && (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded">
                                Confirmed
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-black/50">
                            <span className="font-medium text-black/70">
                              {guest.room_type || guest.property}
                            </span>
                            {guest.room_type && guest.property && (
                              <span className="text-black/35">({guest.property})</span>
                            )}
                            <span>
                              {formatDate(guest.check_in)} → {formatDate(guest.check_out)}
                            </span>
                            {guest.guests_count && (
                              <span>{guest.guests_count} guest{parseInt(guest.guests_count) !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                          {(guest.stated_arrival_time || guest.arrival_time_confirmed) && (
                            <div className="mt-2.5 text-[13px]">
                              {guest.stated_arrival_time && (
                                <span className="text-black/40">
                                  Stated: {guest.stated_arrival_time}
                                </span>
                              )}
                              {guest.arrival_time_confirmed && (
                                <span className="ml-3 text-emerald-700 font-medium">
                                  Confirmed: {guest.arrival_time_confirmed}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {guest.phone && (
                            <button
                              onClick={() => handleSendWhatsApp(guest)}
                              disabled={updating === guest.booking_id}
                              className="px-3.5 py-2 text-[12px] font-semibold border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            >
                              WhatsApp
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleConfirmed(guest)}
                            disabled={updating === guest.booking_id}
                            className={`px-3.5 py-2 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                              isConfirmed
                                ? "border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                                : "border border-black/15 text-black/70 hover:border-black/30 hover:bg-black/[0.02]"
                            }`}
                          >
                            {updating === guest.booking_id ? "..." : isConfirmed ? "✓ Confirmed" : "Mark Confirmed"}
                          </button>
                        </div>
                      </div>

                      {guest.arrival_request_sent && (
                        <p className="mt-3 text-[11px] text-black/35 font-medium">
                          Request sent: {new Date(guest.arrival_request_sent).toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
