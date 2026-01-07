"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Booking {
  Booking_ID: string;
  Timestamp: string;
  property: string;
  room: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  checkIn: string;
  checkOut: string;
  nights: string;
  guests: string;
  adults: string;
  children: string;
  total: string;
  status: string;
  source: string;
  specialRequests: string;
  arrivalTimeStated: string;
  arrivalRequestSent: string;
  arrivalConfirmed: string;
  arrivalTimeConfirmed: string;
  readMessages: string;
  midstayCheckin: string;
  notes: string;
  updatedAt: string;
}

type SortField = "Booking_ID" | "Name" | "Property" | "CheckIn" | "Guests" | "Total" | "Status" | "Timestamp" | "Source";
type SortDirection = "asc" | "desc";

const propertyOptions = ["ALL", "riad", "douaria"];
const statusOptions = ["ALL", "confirmed", "pending", "cancelled"];
const sourceOptions = ["ALL", "booking.com", "airbnb", "direct", "manual", "whatsapp"];

// Booking source icons
const SourceIcons: { [key: string]: React.ReactNode } = {
  "booking.com": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#003580" aria-label="Booking.com">
      <rect x="3" y="7" width="18" height="10" rx="1" fill="#003580"/>
      <text x="12" y="14" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">B.</text>
    </svg>
  ),
  airbnb: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF5A5F" aria-label="Airbnb">
      <path d="M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.239-1.142-.1-2.063.414-2.741.379-.5.912-.78 1.533-.825.089-.006.178-.01.267-.01.647 0 1.242.226 1.654.63.459.45.71 1.09.71 1.803 0 1.097-.53 2.396-1.543 3.775l-.622.825zm7.063-2.378c-.211 1.168-.862 2.221-1.826 2.961-1.005.771-2.259 1.181-3.629 1.181-.469 0-.95-.05-1.432-.152-.375-.08-.744-.193-1.103-.339-.108-.044-.214-.091-.32-.14l-.18-.084a7.37 7.37 0 0 1-.573-.32 9.381 9.381 0 0 1-1.395-1.026c-.42-.37-.819-.77-1.193-1.196-1.69-1.924-2.74-4.095-2.74-5.925 0-1.262.465-2.412 1.309-3.239.777-.76 1.8-1.178 2.882-1.178.304 0 .612.034.916.103.906.205 1.735.672 2.4 1.352.665-.68 1.494-1.147 2.4-1.352.304-.069.612-.103.916-.103 1.082 0 2.105.418 2.882 1.178.844.827 1.309 1.977 1.309 3.239 0 1.83-1.05 4.001-2.74 5.925a13.817 13.817 0 0 1-1.193 1.196 9.381 9.381 0 0 1-1.395 1.026c-.185.11-.377.218-.573.32l-.18.084c-.106.049-.212.096-.32.14-.359.146-.728.259-1.103.339-.482.102-.963.152-1.432.152-1.37 0-2.624-.41-3.629-1.181-.964-.74-1.615-1.793-1.826-2.961-.061-.338-.092-.683-.092-1.032 0-2.177 1.232-4.69 3.205-6.93.188-.214.382-.423.582-.627.2-.204.407-.403.618-.597.422-.387.867-.747 1.329-1.076.231-.165.467-.323.707-.473.24-.15.484-.293.731-.428.494-.27.999-.502 1.511-.693a8.917 8.917 0 0 1 1.571-.437c.262-.048.525-.082.787-.103.131-.01.262-.016.392-.016.13 0 .261.006.392.016.262.021.525.055.787.103.527.095 1.053.24 1.571.437.512.191 1.017.423 1.511.693.247.135.491.278.731.428.24.15.476.308.707.473.462.329.907.689 1.329 1.076.211.194.418.393.618.597.2.204.394.413.582.627 1.973 2.24 3.205 4.753 3.205 6.93 0 .349-.031.694-.092 1.032z"/>
    </svg>
  ),
  direct: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Direct">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  manual: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Manual">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  whatsapp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" aria-label="WhatsApp">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
};

// Clean, minimal SVG icons (Anthropic-style)
const Icons = {
  view: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
    </svg>
  ),
  email: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="14" height="10" rx="1" />
      <path d="M1 4l7 5 7-5" />
    </svg>
  ),
  sortAsc: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 3l4 6H2l4-6z" />
    </svg>
  ),
  sortDesc: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 9l4-6H2l4 6z" />
    </svg>
  ),
  sort: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.3">
      <path d="M6 2l3 4H3l3-4zM6 10l3-4H3l3 4z" />
    </svg>
  ),
};

const statusColors: { [key: string]: string } = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-700",
};

const propertyLabels: { [key: string]: string } = {
  riad: "The Riad",
  douaria: "The Douaria",
};

const sourceLabels: { [key: string]: string } = {
  "booking.com": "Booking.com",
  airbnb: "Airbnb",
  direct: "Direct",
  manual: "Manual",
  whatsapp: "WhatsApp",
};

function BookingsContent() {
  const searchParams = useSearchParams();
  const initialProperty = searchParams.get("property") || "ALL";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState(initialProperty);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>("Timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Selected booking for detail view
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    fetch("/api/admin/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(data.bookings || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const getPropertyKey = (booking: Booking): string => {
    if (booking.property?.toLowerCase().includes("kasbah")) return "kasbah";
    if (booking.property?.toLowerCase().includes("desert")) return "desert";
    if (booking.property?.toLowerCase().includes("douaria") || booking.room?.toLowerCase().includes("love") || booking.room?.toLowerCase().includes("joy") || booking.room?.toLowerCase().includes("bliss")) return "douaria";
    return "riad";
  };

  const getPropertyLabel = (booking: Booking): string => {
    const key = getPropertyKey(booking);
    return propertyLabels[key] || "The Riad";
  };

  const getRoomName = (booking: Booking): string => {
    return booking.room || "—";
  };

  const getBookingSource = (booking: Booking): string => {
    // Source is always set from Master_Guests
    return booking.source || "unknown";
  };

  // Filter and sort bookings
  const filteredAndSortedBookings = useMemo(() => {
    let result = [...bookings];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.Booking_ID?.toLowerCase().includes(query) ||
          b.firstName?.toLowerCase().includes(query) ||
          b.lastName?.toLowerCase().includes(query) ||
          b.email?.toLowerCase().includes(query) ||
          b.room?.toLowerCase().includes(query) ||
          b.country?.toLowerCase().includes(query)
      );
    }

    // Apply property filter
    if (propertyFilter !== "ALL") {
      result = result.filter((b) => getPropertyKey(b) === propertyFilter);
    }

    // Apply status filter
    if (statusFilter !== "ALL") {
      result = result.filter((b) => (b.status || "pending") === statusFilter);
    }

    // Apply source filter
    if (sourceFilter !== "ALL") {
      result = result.filter((b) => getBookingSource(b) === sourceFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortField) {
        case "Booking_ID":
          aVal = a.Booking_ID || "";
          bVal = b.Booking_ID || "";
          break;
        case "Name":
          aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
          bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case "Property":
          aVal = getPropertyLabel(a);
          bVal = getPropertyLabel(b);
          break;
        case "CheckIn":
          aVal = a.checkIn ? new Date(a.checkIn).getTime() : 0;
          bVal = b.checkIn ? new Date(b.checkIn).getTime() : 0;
          break;
        case "Guests":
          aVal = a.guests || 0;
          bVal = b.guests || 0;
          break;
        case "Total":
          aVal = parseFloat(a.total) || 0;
          bVal = parseFloat(b.total) || 0;
          break;
        case "Status":
          aVal = a.status || "pending";
          bVal = b.status || "pending";
          break;
        case "Source":
          aVal = getBookingSource(a);
          bVal = getBookingSource(b);
          break;
        case "Timestamp":
          aVal = a.Timestamp ? new Date(a.Timestamp).getTime() : 0;
          bVal = b.Timestamp ? new Date(b.Timestamp).getTime() : 0;
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [bookings, searchQuery, propertyFilter, statusFilter, sourceFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="text-left p-4 text-[10px] uppercase tracking-[0.08em] text-black/40 font-semibold cursor-pointer hover:text-black select-none"
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="ml-1">
          {sortField === field
            ? sortDirection === "asc"
              ? Icons.sortAsc
              : Icons.sortDesc
            : Icons.sort}
        </span>
      </div>
    </th>
  );

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Search Bar - Top */}
      <div className="border-b border-black/[0.06] bg-black/[0.02] py-4 px-6">
        <div className="container mx-auto">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[300px] relative">
              <input
                type="text"
                placeholder="Search by name, email, booking ID, or room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 rounded-lg border border-black/[0.06] bg-white text-[13px] focus:outline-none focus:border-black/20"
              />
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5"
              >
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l3 3" />
              </svg>
            </div>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-black/[0.06] bg-white text-[13px] focus:outline-none focus:border-black/20 min-w-[150px]"
            >
              <option value="ALL">All Properties</option>
              <option value="riad">The Riad</option>
              <option value="douaria">The Douaria</option>
              <option value="kasbah">The Kasbah</option>
              <option value="desert">Desert Camp</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-black/[0.06] bg-white text-[13px] focus:outline-none focus:border-black/20 min-w-[140px]"
            >
              <option value="ALL">All Sources</option>
              <option value="paypal">PayPal</option>
              <option value="airbnb">Airbnb</option>
              <option value="booking">Booking.com</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="walkin">Walk-in</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-black/[0.06] bg-white text-[13px] focus:outline-none focus:border-black/20 min-w-[130px]"
            >
              <option value="ALL">All Status</option>
              <option value="COMPLETED">Confirmed</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-black/[0.06] py-5 px-6">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mb-1">Admin</p>
            <h1 className="font-serif text-[22px] text-black">All Bookings</h1>
            <p className="text-[13px] text-black/50 mt-1">
              {filteredAndSortedBookings.length} of {bookings.length} bookings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/reservations/new"
              className="text-[11px] uppercase tracking-[0.08em] font-semibold bg-black text-white px-4 py-2.5 rounded-lg hover:bg-black/90 transition-colors"
            >
              + Add Reservation
            </Link>
            <Link
              href="/admin"
              className="text-[11px] uppercase tracking-[0.08em] font-semibold border border-black/15 px-4 py-2.5 rounded-lg hover:border-black/30 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 text-[13px] text-black/40">
            No bookings found.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-black/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-black/[0.06] bg-black/[0.02]">
                  <tr>
                    <SortHeader field="Source">Source</SortHeader>
                    <SortHeader field="Timestamp">Date</SortHeader>
                    <SortHeader field="Name">Guest</SortHeader>
                    <SortHeader field="Property">Property</SortHeader>
                    <SortHeader field="CheckIn">Check-in</SortHeader>
                    <SortHeader field="Guests">Guests</SortHeader>
                    <SortHeader field="Total">Total</SortHeader>
                    <SortHeader field="Status">Status</SortHeader>
                    <th className="text-right p-4 text-[10px] uppercase tracking-[0.08em] text-black/40 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filteredAndSortedBookings.map((booking) => (
                    <tr key={booking.Booking_ID} className="hover:bg-black/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center justify-center" title={sourceLabels[getBookingSource(booking)] || "Unknown"}>
                          {SourceIcons[getBookingSource(booking)] || SourceIcons.walkin}
                        </div>
                      </td>
                      <td className="p-4 text-[13px] text-black/50">{formatDate(booking.Timestamp)}</td>
                      <td className="p-4">
                        <p className="text-[13px] font-medium text-black">{booking.firstName} {booking.lastName}</p>
                        <p className="text-[11px] text-black/40">{booking.email}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-[13px] text-black">{getPropertyLabel(booking)}</p>
                        <p className="text-[11px] text-black/40">{getRoomName(booking)}</p>
                      </td>
                      <td className="p-4 text-[13px] text-black">
                        {formatDate(booking.checkIn || "")}
                        {booking.nights && <span className="text-black/40"> ({booking.nights}n)</span>}
                      </td>
                      <td className="p-4 text-[13px] text-black">{booking.guests}</td>
                      <td className="p-4 text-[13px] font-medium text-black">€{booking.total}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${statusColors[booking.status || "pending"] || "bg-gray-100 text-gray-700"}`}>
                          {booking.status || "pending"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="p-2 text-black/40 hover:text-black hover:bg-black/[0.04] rounded-lg transition-colors"
                            title="View Details"
                          >
                            {Icons.view}
                          </button>
                          <a
                            href={`mailto:${booking.email}`}
                            className="p-2 text-black/40 hover:text-black hover:bg-black/[0.04] rounded-lg transition-colors"
                            title="Email Guest"
                          >
                            {Icons.email}
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedBooking(null)} />
          <div className="relative bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-black/[0.06] p-5 flex items-center justify-between rounded-t-lg">
              <h2 className="font-serif text-[18px] text-black">Booking Details</h2>
              <button 
                onClick={() => setSelectedBooking(null)}
                className="text-black/30 hover:text-black/60 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Booking ID</p>
                <p className="font-mono text-[13px] text-black">{selectedBooking.Booking_ID}</p>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Source</p>
                  <div className="flex items-center gap-2">
                    {SourceIcons[getBookingSource(selectedBooking)] || SourceIcons.walkin}
                    <span className="text-[13px] text-black">{sourceLabels[getBookingSource(selectedBooking)] || "Unknown"}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Date</p>
                  <p className="text-[13px] text-black">{formatDate(selectedBooking.Timestamp)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Guest</p>
                  <p className="text-[15px] font-medium text-black">{selectedBooking.firstName} {selectedBooking.lastName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Email</p>
                  <p className="text-[13px] text-black">{selectedBooking.email}</p>
                </div>
              </div>
              {selectedBooking.phone && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Phone</p>
                  <p className="text-[13px] text-black">{selectedBooking.phone}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Property</p>
                  <p className="text-[13px] text-black">{getPropertyLabel(selectedBooking)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Room/Tent</p>
                  <p className="text-[13px] text-black">{getRoomName(selectedBooking)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Check-in</p>
                  <p className="text-[13px] text-black">{formatDate(selectedBooking.checkIn || "")}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Check-out</p>
                  <p className="text-[13px] text-black">{formatDate(selectedBooking.checkOut || "")}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Nights</p>
                  <p className="text-[13px] text-black">{selectedBooking.nights || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Guests</p>
                  <p className="text-[13px] text-black">
                    {selectedBooking.adults} adult{parseInt(selectedBooking.adults) !== 1 ? "s" : ""}
                    {parseInt(selectedBooking.children) > 0 && `, ${selectedBooking.children} child${parseInt(selectedBooking.children) !== 1 ? "ren" : ""}`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Total</p>
                  <p className="text-[18px] font-serif text-black">€{selectedBooking.total}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Status</p>
                  <span className={`text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${statusColors[selectedBooking.status || "pending"]}`}>
                    {selectedBooking.status || "pending"}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Source</p>
                  <p className="text-[13px] capitalize text-black">{selectedBooking.source}</p>
                </div>
              </div>
              {selectedBooking.country && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Country</p>
                  <p className="text-[13px] text-black">{selectedBooking.country}</p>
                </div>
              )}
              {selectedBooking.arrivalTimeStated && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Arrival Time</p>
                  <p className="text-[13px] text-black">{selectedBooking.arrivalTimeStated}</p>
                </div>
              )}
              {selectedBooking.specialRequests && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Special Requests</p>
                  <p className="text-[13px] text-black/60">{selectedBooking.specialRequests}</p>
                </div>
              )}
              {selectedBooking.notes && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-black/40 mb-1">Notes</p>
                  <p className="text-[13px] text-black/60">{selectedBooking.notes}</p>
                </div>
              )}
              <div className="pt-4 border-t border-black/[0.06]">
                <a
                  href={`mailto:${selectedBooking.email}`}
                  className="block w-full text-center text-[11px] uppercase tracking-[0.08em] font-semibold border border-black text-black px-4 py-3 rounded-lg hover:bg-black hover:text-white transition-colors"
                >
                  Email Guest
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    }>
      <BookingsContent />
    </Suspense>
  );
}
