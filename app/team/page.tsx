"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PasswordGate from "@/components/PasswordGate";
import PoliceRegistrationForm from "@/components/PoliceRegistrationForm";

interface GuestSummary {
  booking_id: string;
  guest_name: string;
  room: string;
  property: string;
  arrival_time: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  channel: string;
  special_requests: string;
  notes: string;
  phone: string;
  email: string;
  city_tax_paid: string;
}

interface TodayData {
  date: string;
  checkIns: GuestSummary[];
  checkOuts: GuestSummary[];
}

interface TaxStats {
  date: string;
  month: string;
  daily: {
    total: number;
    paid: number;
    unpaid: number;
    bookings: Array<{
      booking_id: string;
      guest_name: string;
      tax_amount: number;
      paid: boolean;
      paid_at: string;
    }>;
  };
  monthly: {
    total: number;
    paid: number;
    unpaid: number;
    bookingCount: number;
  };
}

// Channel badge with proper colors and labels
function ChannelBadge({ channel }: { channel: string }) {
  const ch = (channel || "").toLowerCase();
  
  if (ch.includes("booking")) {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide bg-blue-100 text-blue-700">
        BOOKING
      </span>
    );
  }
  if (ch.includes("airbnb")) {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide bg-pink-100 text-pink-700">
        AIRBNB
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide bg-emerald-100 text-emerald-700">
      DIRECT
    </span>
  );
}

// Helper to format date as YYYY-MM-DD
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to check if date is today
function isToday(dateStr: string): boolean {
  return toDateString(new Date()) === dateStr;
}

// Calculate city tax (only for Booking.com guests)
function calculateCityTax(guest: GuestSummary): number | null {
  const ch = (guest.channel || "").toLowerCase();
  if (!ch.includes("booking")) return null;
  return 2.5 * guest.guests * guest.nights;
}

// GuestCard component - OUTSIDE the main component to prevent re-renders
interface GuestCardProps {
  guest: GuestSummary;
  isCheckIn: boolean;
  editingNotesId: string | null;
  notesText: string;
  setEditingNotesId: (id: string | null) => void;
  setNotesText: (text: string) => void;
  saveNotes: (guest: GuestSummary) => void;
  savingNotes: boolean;
  copiedId: string | null;
  activeGuestId: string | null;
  setActiveGuestId: (id: string | null) => void;
  manualTime: string;
  setManualTime: (time: string) => void;
  saveManualTime: (guest: GuestSummary) => void;
  saving: boolean;
  copyArrivalLink: (guest: GuestSummary) => void;
  sendArrivalWhatsApp: (guest: GuestSummary) => void;
  sendDirectionsWhatsApp: (guest: GuestSummary) => void;
  onOpenPoliceForm: (guest: GuestSummary) => void;
  markTaxPaid: (guest: GuestSummary) => void;
  markingTaxId: string | null;
}

function GuestCard({
  guest,
  isCheckIn,
  editingNotesId,
  notesText,
  setEditingNotesId,
  setNotesText,
  saveNotes,
  savingNotes,
  copiedId,
  activeGuestId,
  setActiveGuestId,
  manualTime,
  setManualTime,
  saveManualTime,
  saving,
  copyArrivalLink,
  sendArrivalWhatsApp,
  sendDirectionsWhatsApp,
  onOpenPoliceForm,
  markTaxPaid,
  markingTaxId,
}: GuestCardProps) {
  const cityTax = calculateCityTax(guest);
  const isEditing = editingNotesId === guest.booking_id;
  const isMarkingTax = markingTaxId === guest.booking_id;
  const taxPaid = !!guest.city_tax_paid;

  return (
    <div className="bg-white border border-black/[0.06] rounded-lg p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-[15px] text-black/90">{guest.guest_name}</p>
            <ChannelBadge channel={guest.channel} />
          </div>
          <p className="text-black/50 text-[13px] mt-1">
            {guest.room && `${guest.room} · `}
            {guest.property}
          </p>
          {/* Contact buttons */}
          {(guest.phone || guest.email) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {guest.phone && (
                <>
                  <a
                    href={`https://wa.me/${guest.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${guest.phone}`}
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-black/5 text-black/60 hover:bg-black/10 font-medium"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call
                  </a>
                  {isCheckIn && (
                    <button
                      onClick={() => sendDirectionsWhatsApp(guest)}
                      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Send Directions
                    </button>
                  )}
                </>
              )}
              {guest.email && (
                <a
                  href={`mailto:${guest.email}`}
                  className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-black/5 text-black/60 hover:bg-black/10 font-medium"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </a>
              )}
            </div>
          )}
        </div>

        {/* Arrival time section (only for check-ins) */}
        {isCheckIn && (
          <>
            {guest.arrival_time ? (
              <div className="text-right">
                <p className="font-semibold text-[22px] text-emerald-600">{guest.arrival_time}</p>
                <p className="text-[10px] uppercase tracking-wide text-black/40 mt-0.5">Arrival</p>
              </div>
            ) : (
              <div className="text-right">
                {activeGuestId === guest.booking_id ? (
                  <div className="space-y-2">
                    <input
                      type="time"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      className="w-24 px-2 py-1 text-sm border border-black/20 rounded"
                    />
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => saveManualTime(guest)}
                        disabled={saving || !manualTime}
                        className="text-[11px] px-2 py-1 bg-emerald-600 text-white rounded disabled:opacity-50"
                      >
                        {saving ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => setActiveGuestId(null)}
                        className="text-[11px] px-2 py-1 bg-black/5 text-black/60 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-amber-600 text-[11px] font-medium">No arrival time</p>
                    <div className="flex flex-col gap-1">
                      {guest.phone && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => sendArrivalWhatsApp(guest)}
                            className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Send Form
                          </button>
                          <button
                            onClick={() => copyArrivalLink(guest)}
                            className="text-[10px] px-2 py-1 bg-black/5 text-black/60 rounded hover:bg-black/10"
                          >
                            {copiedId === guest.booking_id ? "Copied!" : "Copy Link"}
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setActiveGuestId(guest.booking_id);
                          setManualTime("");
                        }}
                        className="text-[10px] px-2 py-1 bg-black/5 text-black/60 rounded hover:bg-black/10"
                      >
                        Enter Time
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Stay info */}
      <div className="grid grid-cols-3 gap-3 py-2 border-t border-black/[0.06]">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-black/40">Nights</p>
          <p className="text-[14px] font-medium">{guest.nights}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-black/40">Guests</p>
          <p className="text-[14px] font-medium">{guest.guests}</p>
        </div>
        {cityTax !== null && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-black/40">City Tax</p>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-medium">€{cityTax.toFixed(2)}</p>
              {taxPaid && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                  PAID
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* City Tax Mark as Paid - only for Booking.com guests with unpaid tax */}
      {cityTax !== null && !taxPaid && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => markTaxPaid(guest)}
            disabled={isMarkingTax}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {isMarkingTax ? "Saving..." : "Mark Tax Paid"}
          </button>
        </div>
      )}

      {/* Dates row */}
      <div className="flex gap-4 text-[12px] text-black/50">
        <span>In: {guest.check_in?.split("T")[0]}</span>
        <span>Out: {guest.check_out?.split("T")[0]}</span>
      </div>

      {/* Police Registration button - only for check-ins */}
      {isCheckIn && (
        <div className="pt-2">
          <button
            onClick={() => onOpenPoliceForm(guest)}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Police Registration
          </button>
        </div>
      )}

      {/* Special requests */}
      {guest.special_requests && (
        <div className="pt-2 border-t border-black/[0.06]">
          <p className="text-[10px] uppercase tracking-wide text-black/40 mb-1">Guest Requests</p>
          <p className="text-[13px] text-black/70">{guest.special_requests}</p>
        </div>
      )}

      {/* Staff notes */}
      <div className="pt-2 border-t border-black/[0.06]">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add internal notes..."
              className="w-full px-3 py-2 text-[13px] border border-black/20 rounded resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveNotes(guest)}
                disabled={savingNotes}
                className="text-[11px] px-3 py-1.5 bg-black text-white rounded hover:bg-black/80 disabled:opacity-50"
              >
                {savingNotes ? "Saving..." : "Save Note"}
              </button>
              <button
                onClick={() => setEditingNotesId(null)}
                className="text-[11px] px-3 py-1.5 bg-black/5 text-black/60 rounded hover:bg-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : guest.notes ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-wide text-black/40">Staff Notes</p>
              <button
                onClick={() => { setEditingNotesId(guest.booking_id); setNotesText(guest.notes); }}
                className="text-[10px] text-black/40 hover:text-black/60"
              >
                Edit
              </button>
            </div>
            <p className="text-[13px] text-black/70 whitespace-pre-wrap">{guest.notes}</p>
          </div>
        ) : (
          <button
            onClick={() => { setEditingNotesId(guest.booking_id); setNotesText(""); }}
            className="text-xs text-foreground/40 hover:text-foreground/60 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add staff notes
          </button>
        )}
      </div>
    </div>
  );
}

// Search result card - simplified version
function SearchResultCard({ guest, onSelect }: { guest: GuestSummary; onSelect: (date: string) => void }) {
  const checkInDate = guest.check_in?.split("T")[0] || "";
  
  return (
    <button
      onClick={() => onSelect(checkInDate)}
      className="w-full text-left bg-white border border-black/[0.06] rounded-lg p-3 hover:border-black/20 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-[14px] text-black/90">{guest.guest_name}</p>
            <ChannelBadge channel={guest.channel} />
          </div>
          <p className="text-black/50 text-[12px] mt-0.5">
            {guest.room && `${guest.room} · `}
            {guest.property}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-black/50">Check-in</p>
          <p className="text-[13px] font-medium">{checkInDate}</p>
        </div>
      </div>
      <div className="flex gap-4 text-[11px] text-black/40 mt-2">
        <span>{guest.nights} nights</span>
        <span>{guest.guests} guests</span>
        <span className="text-black/30">ID: {guest.booking_id}</span>
      </div>
    </button>
  );
}

export default function TeamPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState("");
  const [saving, setSaving] = useState(false);

  // Notes editing
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Calendar picker
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GuestSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Police Registration Form
  const [policeFormGuest, setPoliceFormGuest] = useState<GuestSummary | null>(null);

  // City Tax tracking
  const [taxStats, setTaxStats] = useState<TaxStats | null>(null);
  const [markingTaxId, setMarkingTaxId] = useState<string | null>(null);

  // Generate arrival link
  const generateArrivalLink = useCallback((guest: GuestSummary): string => {
    return `https://ops.riaddisiena.com/arrival?id=${guest.booking_id}`;
  }, []);

  // Copy arrival link
  const copyArrivalLink = useCallback(async (guest: GuestSummary) => {
    const link = generateArrivalLink(guest);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(guest.booking_id);
      setActiveGuestId(null);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedId(guest.booking_id);
      setActiveGuestId(null);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [generateArrivalLink]);

  // Send arrival form via WhatsApp
  const sendArrivalWhatsApp = useCallback((guest: GuestSummary) => {
    if (!guest.phone) return;
    
    const link = generateArrivalLink(guest);
    const firstName = guest.guest_name.split(" ")[0];
    const message = `Hello ${firstName}! 🌿

We're looking forward to welcoming you to Riad di Siena.

Please let us know your estimated arrival time by clicking this link:

${link}

See you soon!
— The Riad di Siena Team`;
    
    const phoneNumber = guest.phone.replace(/[^0-9]/g, "");
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
    
    setCopiedId(guest.booking_id);
    setTimeout(() => setCopiedId(null), 2000);
  }, [generateArrivalLink]);

  // Send directions via WhatsApp
  const sendDirectionsWhatsApp = useCallback((guest: GuestSummary) => {
    if (!guest.phone) return;
    
    // Determine directions URL based on property
    const isDouaria = (guest.property || "").toLowerCase().includes("douaria");
    const directionsUrl = isDouaria 
      ? "https://www.riaddisiena.com/directions?building=annex"
      : "https://www.riaddisiena.com/directions";
    
    const firstName = guest.guest_name.split(" ")[0];
    const propertyName = isDouaria ? "The Douaria" : "The Riad";
    
    const message = `Hello ${firstName}! 🗺️

Here are the directions to ${propertyName}:

${directionsUrl}

See you soon!
— The Riad di Siena Team`;
    
    const phoneNumber = guest.phone.replace(/[^0-9]/g, "");
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  }, []);

  // Save manual arrival time
  const saveManualTime = useCallback(async (guest: GuestSummary) => {
    if (!manualTime) return;
    setSaving(true);
    try {
      const res = await fetch("/api/arrival/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: guest.booking_id,
          arrivalTime: manualTime,
        }),
      });
      if (res.ok) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            checkIns: prev.checkIns.map(g =>
              g.booking_id === guest.booking_id
                ? { ...g, arrival_time: manualTime }
                : g
            ),
          };
        });
        setActiveGuestId(null);
        setManualTime("");
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [manualTime]);

  // Save notes
  const saveNotes = useCallback(async (guest: GuestSummary) => {
    setSavingNotes(true);
    try {
      const res = await fetch("/api/team/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: guest.booking_id,
          notes: notesText,
        }),
      });
      if (res.ok) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            checkIns: prev.checkIns.map(g =>
              g.booking_id === guest.booking_id
                ? { ...g, notes: notesText }
                : g
            ),
            checkOuts: prev.checkOuts.map(g =>
              g.booking_id === guest.booking_id
                ? { ...g, notes: notesText }
                : g
            ),
          };
        });
        setEditingNotesId(null);
      }
    } catch {
      // ignore
    } finally {
      setSavingNotes(false);
    }
  }, [notesText]);

  // Fetch data for selected date
  const fetchData = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/today?date=${date}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setError(null);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tax stats for dashboard
  const fetchTaxStats = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/tax/stats?date=${date}`);
      const json = await res.json();
      if (!json.error) {
        setTaxStats(json);
      }
    } catch {
      // ignore
    }
  }, []);

  // Mark city tax as paid
  const markTaxPaid = useCallback(async (guest: GuestSummary) => {
    setMarkingTaxId(guest.booking_id);
    try {
      const res = await fetch("/api/tax/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: guest.booking_id }),
      });
      if (res.ok) {
        // Refresh data
        fetchData(selectedDate);
        fetchTaxStats(selectedDate);
      }
    } catch {
      // ignore
    } finally {
      setMarkingTaxId(null);
    }
  }, [selectedDate, fetchData, fetchTaxStats]);

  useEffect(() => {
    fetchData(selectedDate);
    fetchTaxStats(selectedDate);
  }, [selectedDate, fetchData, fetchTaxStats]);

  // Search functionality
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/team/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setSearchResults(json.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (searchQuery.length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        handleSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, handleSearch]);

  // Close calendar/search on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navigation - only 3 days back allowed
  const canGoPrevious = (() => {
    const today = new Date();
    const selected = new Date(selectedDate);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    return selected > threeDaysAgo;
  })();

  const handlePrevious = useCallback(() => {
    if (!canGoPrevious) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toDateString(d));
  }, [canGoPrevious, selectedDate]);

  const handleNext = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(toDateString(d));
  }, [selectedDate]);

  const handleToday = useCallback(() => {
    setSelectedDate(toDateString(new Date()));
  }, []);

  // Select date from search result
  const handleSelectSearchResult = useCallback((date: string) => {
    if (date) {
      setSelectedDate(date);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === "ArrowLeft" && canGoPrevious) {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGoPrevious, handlePrevious, handleNext]);

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const formatShortDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  // Generate calendar months
  const generateCalendarMonths = () => {
    const months: { year: number; month: number; days: (number | null)[] }[] = [];
    const today = new Date();
    
    // Generate 6 months forward
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay();
      
      const days: (number | null)[] = [];
      // Add empty slots for days before the 1st
      for (let j = 0; j < firstDayOfWeek; j++) {
        days.push(null);
      }
      // Add all days
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
      }
      
      months.push({ year, month, days });
    }
    
    return months;
  };

  const calendarMonths = generateCalendarMonths();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Error state
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
        <p className="text-red-600 text-[13px]">{error}</p>
      </div>
    );
  }

  // Loading state
  if (!data) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <p className="text-black/40 text-[13px]">Loading...</p>
      </div>
    );
  }

  return (
    <PasswordGate>
    <div className="min-h-screen bg-[#fafafa] pb-16">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-black/35">Riad di Siena</p>
          
          {/* Search button */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Search dropdown - Riad brand design */}
            {showSearch && (
              <div className="absolute right-0 top-12 w-80 bg-sand shadow-2xl z-50 overflow-hidden">
                <div className="p-6">
                  <label className="block text-[10px] tracking-wider uppercase text-foreground/40 mb-2">
                    Search guests
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name or booking ID..."
                    className="w-full py-3 bg-transparent border-b border-foreground/20 focus:border-foreground/40 focus:outline-none text-foreground transition-colors text-[14px]"
                    autoFocus
                  />
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {searchLoading ? (
                    <div className="px-6 pb-6 text-center text-foreground/40 text-[13px]">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="px-6 pb-6 space-y-2">
                      {searchResults.map((guest) => (
                        <SearchResultCard
                          key={guest.booking_id}
                          guest={guest}
                          onSelect={handleSelectSearchResult}
                        />
                      ))}
                    </div>
                  ) : searchQuery.length >= 2 ? (
                    <div className="px-6 pb-6 text-center text-foreground/40 text-[13px]">No results found</div>
                  ) : (
                    <div className="px-6 pb-6 text-center text-foreground/40 text-[13px]">Type to search...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation - using table layout for guaranteed click areas */}
        <div style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
          {/* Previous button cell */}
          <div style={{ display: 'table-cell', width: '60px', verticalAlign: 'middle' }}>
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={handlePrevious}
              onTouchEnd={(e) => { e.preventDefault(); handlePrevious(); }}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${
                canGoPrevious 
                  ? 'border-black/20 hover:border-black/40 cursor-pointer' 
                  : 'border-black/10 cursor-not-allowed opacity-30'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 6L9 12L15 18" />
              </svg>
            </button>
          </div>

          {/* Date display cell - clickable for calendar */}
          <div 
            style={{ display: 'table-cell', textAlign: 'center', verticalAlign: 'middle' }}
            className="relative"
            ref={calendarRef}
          >
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="inline-block hover:opacity-70 transition-opacity"
            >
              {isToday(selectedDate) ? (
                <p className="font-serif text-[22px] text-black/90">Today</p>
              ) : (
                <p className="font-serif text-[22px] text-black/90">{formatShortDate(selectedDate)}</p>
              )}
              <p className="text-[11px] text-black/40 mt-1 flex items-center justify-center gap-1">
                {formatDate(selectedDate)}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </p>
            </button>

            {!isToday(selectedDate) && (
              <button
                type="button"
                onClick={handleToday}
                className="text-[11px] text-black/40 hover:text-black/60 underline mt-1"
              >
                Back to today
              </button>
            )}

            {/* Calendar dropdown - Riad brand design */}
            {showCalendar && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-sand shadow-2xl z-50 p-6 w-[320px]">
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => {/* scroll up */}}
                    className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="10,2 5,8 10,14" />
                    </svg>
                  </button>
                  <span className="text-sm tracking-wide text-foreground/70">
                    Select Date
                  </span>
                  <button
                    onClick={() => {/* scroll down */}}
                    className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="6,2 11,8 6,14" />
                    </svg>
                  </button>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {calendarMonths.map(({ year, month, days }) => (
                    <div key={`${year}-${month}`} className="mb-6">
                      <p className="text-sm tracking-wide text-foreground/70 mb-4 text-center">
                        {monthNames[month]} {year}
                      </p>
                      
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-2">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                          <div key={d} className="text-center text-[10px] tracking-wider text-foreground/30 uppercase">
                            {d}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {days.map((day, i) => {
                          if (day === null) {
                            return <div key={i} className="aspect-square" />;
                          }
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const isSelected = dateStr === selectedDate;
                          const isTodayDate = dateStr === toDateString(new Date());
                          
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setSelectedDate(dateStr);
                                setShowCalendar(false);
                              }}
                              className={`
                                aspect-square flex items-center justify-center text-sm relative transition-all
                                ${isSelected ? "bg-foreground text-sand" : ""}
                                ${isTodayDate && !isSelected ? "bg-foreground/10" : ""}
                                ${!isSelected ? "text-foreground/70 hover:bg-foreground/5" : ""}
                              `}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-foreground/10">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-foreground" />
                    <span className="text-[10px] tracking-wide text-foreground/40 uppercase">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-foreground/10" />
                    <span className="text-[10px] tracking-wide text-foreground/40 uppercase">Today</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Next button cell */}
          <div style={{ display: 'table-cell', width: '60px', verticalAlign: 'middle', textAlign: 'right' }}>
            <button
              type="button"
              onClick={handleNext}
              onTouchEnd={(e) => { e.preventDefault(); handleNext(); }}
              className="w-12 h-12 rounded-full border-2 border-black/20 hover:border-black/40 flex items-center justify-center transition-colors"
              style={{ WebkitTapHighlightColor: 'transparent', display: 'inline-flex' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6L15 12L9 18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-30">
          <div className="w-6 h-6 border-2 border-black/10 border-t-black rounded-full animate-spin" />
        </div>
      )}

      <div className="p-6 space-y-8">
        {/* Check-ins */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
              </svg>
            </div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/50">Arrivals</h2>
            <span className="ml-auto font-serif text-[28px] text-black/90">{data.checkIns.length}</span>
          </div>

          {data.checkIns.length === 0 ? (
            <p className="text-black/35 text-[13px] py-4">No arrivals today</p>
          ) : (
            <div className="space-y-3">
              {data.checkIns.map((guest) => (
                <GuestCard
                  key={guest.booking_id}
                  guest={guest}
                  isCheckIn={true}
                  editingNotesId={editingNotesId}
                  notesText={notesText}
                  setEditingNotesId={setEditingNotesId}
                  setNotesText={setNotesText}
                  saveNotes={saveNotes}
                  savingNotes={savingNotes}
                  copiedId={copiedId}
                  activeGuestId={activeGuestId}
                  setActiveGuestId={setActiveGuestId}
                  manualTime={manualTime}
                  setManualTime={setManualTime}
                  saveManualTime={saveManualTime}
                  saving={saving}
                  copyArrivalLink={copyArrivalLink}
                  sendArrivalWhatsApp={sendArrivalWhatsApp}
                  sendDirectionsWhatsApp={sendDirectionsWhatsApp}
                  onOpenPoliceForm={setPoliceFormGuest}
                  markTaxPaid={markTaxPaid}
                  markingTaxId={markingTaxId}
                />
              ))}
            </div>
          )}
        </section>

        {/* Check-outs */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/50">Departures</h2>
            <span className="ml-auto font-serif text-[28px] text-black/90">{data.checkOuts.length}</span>
          </div>

          {data.checkOuts.length === 0 ? (
            <p className="text-black/35 text-[13px] py-4">No departures today</p>
          ) : (
            <div className="space-y-3">
              {data.checkOuts.map((guest) => (
                <GuestCard
                  key={guest.booking_id}
                  guest={guest}
                  isCheckIn={false}
                  editingNotesId={editingNotesId}
                  notesText={notesText}
                  setEditingNotesId={setEditingNotesId}
                  setNotesText={setNotesText}
                  saveNotes={saveNotes}
                  savingNotes={savingNotes}
                  copiedId={copiedId}
                  activeGuestId={activeGuestId}
                  setActiveGuestId={setActiveGuestId}
                  manualTime={manualTime}
                  setManualTime={setManualTime}
                  saveManualTime={saveManualTime}
                  saving={saving}
                  copyArrivalLink={copyArrivalLink}
                  sendArrivalWhatsApp={sendArrivalWhatsApp}
                  sendDirectionsWhatsApp={sendDirectionsWhatsApp}
                  onOpenPoliceForm={setPoliceFormGuest}
                  markTaxPaid={markTaxPaid}
                  markingTaxId={markingTaxId}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/[0.06] px-6 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <p className="text-[11px] text-black/30 tracking-wide">
            Tap date to open calendar
          </p>
          {/* City Tax Dashboard Button */}
          {taxStats && (
            <button
              onClick={() => {/* Could open a detailed modal in future */}}
              className="flex items-center gap-3 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-amber-600">Today</span>
                <span className="text-[13px] font-medium text-amber-700">€{taxStats.daily.total.toFixed(0)}</span>
                {taxStats.daily.unpaid > 0 && (
                  <span className="text-[10px] text-amber-500">({taxStats.daily.bookings.filter(b => !b.paid).length} pending)</span>
                )}
              </div>
              <div className="w-px h-4 bg-amber-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-amber-600">Month</span>
                <span className="text-[13px] font-medium text-amber-700">€{taxStats.monthly.total.toFixed(0)}</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Police Registration Form Modal */}
      {policeFormGuest && (
        <PoliceRegistrationForm
          bookingId={policeFormGuest.booking_id}
          guestName={policeFormGuest.guest_name}
          checkIn={policeFormGuest.check_in}
          checkOut={policeFormGuest.check_out}
          guestCount={policeFormGuest.guests}
          onClose={() => setPoliceFormGuest(null)}
        />
      )}
    </div>
    </PasswordGate>
  );
}
