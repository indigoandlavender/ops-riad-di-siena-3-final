"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import PasswordGate from "@/components/PasswordGate";

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
  email?: string;
  phone?: string;
  rowIndex?: number;
  firstName?: string;
  lastName?: string;
  country?: string;
  language?: string;
  notes?: string;
}

interface ImportResults {
  added: number;
  updated: number;
  unchanged: number;
  cancelled: number;
  errors: string[];
  changes: string[];
  source?: string;
}

// Helper to get color with flexible matching
const getSourceColor = (source: string): string => {
  const s = (source || "").trim().toLowerCase();
  if (s.includes("blackout") || s.includes("blocked")) return "bg-[#4a4a4a]";
  if (s.includes("airbnb")) return "bg-[#E8A9A9]";
  if (s.includes("booking")) return "bg-[#89CFF0]";
  // Website, WhatsApp, Direct, Email, Other all get olive green
  return "bg-[#A3B18A]";
};

const getSourceTextColor = (source: string): string => {
  const s = (source || "").trim().toLowerCase();
  if (s.includes("blackout") || s.includes("blocked")) return "text-white/70";
  if (s.includes("airbnb")) return "text-[#6b3a3a]";
  if (s.includes("booking")) return "text-[#1a4a6e]";
  return "text-[#3a4a34]";
};

// Parse individual room names from a booking
const parseRoomNames = (roomStr: string): string[] => {
  if (!roomStr) return [];
  return roomStr.split(/[\/\+]/).map(r => r.trim()).filter(Boolean);
};

// Parse date string as LOCAL date (not UTC) - fixes timezone shift issue
const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  // Handle both "2026-01-14" and "2026-01-14T00:00:00" formats
  const parts = dateStr.split("T")[0].split("-");
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

// Format date to YYYY-MM-DD string
const toDateStr = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Canonical room list
const RIAD_ROOMS = ["Hidden Gem", "Jewel Box", "Trésor Caché"];
const DOUARIA_ROOMS = ["Bliss", "Joy", "Love"];
const ALL_ROOMS = [...RIAD_ROOMS, ...DOUARIA_ROOMS];

// Source options for new bookings
const BOOKING_SOURCES = ["Website", "WhatsApp", "Direct", "Email", "Other"];

export default function HomePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 3);
    return today;
  });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    checkIn: "",
    checkOut: "",
    email: "",
    phone: "",
    source: "",
    room: "",
    country: "",
    language: "",
    notes: "",
  });
  const [newBooking, setNewBooking] = useState<{room: string; date: string} | null>(null);
  const [newBookingForm, setNewBookingForm] = useState({
    firstName: "",
    lastName: "",
    checkIn: "",
    checkOut: "",
    email: "",
    phone: "",
    country: "",
    language: "",
    notes: "",
    source: "Direct",
    room: "",
    isBlackout: false,
    totalEur: "",
    ratePerNight: "",
  });
  const [savingBooking, setSavingBooking] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState(false);
  const [includePaymentLink, setIncludePaymentLink] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // New booking calendar picker state
  const [newBookingCalendarMonth, setNewBookingCalendarMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [selectingDate, setSelectingDate] = useState<"checkIn" | "checkOut">("checkIn");

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState<"booking" | "airbnb">("booking");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const DAYS_TO_SHOW = 42;
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  
  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };
    
    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);
  
  // Generate months for date picker (current month + 15 months into future)
  const datePickerMonths = useMemo(() => {
    const months: { year: number; month: number; days: Date[] }[] = [];
    const today = new Date();
    
    for (let i = 0; i < 16; i++) {
      const year = today.getFullYear() + Math.floor((today.getMonth() + i) / 12);
      const month = (today.getMonth() + i) % 12;
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const days: Date[] = [];
      // Add empty slots for days before the first day of the month
      const startDayOfWeek = firstDay.getDay();
      // Adjust for Monday start (0 = Monday, 6 = Sunday)
      const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
      for (let j = 0; j < adjustedStartDay; j++) {
        days.push(new Date(year, month, -(adjustedStartDay - j - 1)));
      }
      // Add all days of the month
      for (let j = 1; j <= lastDay.getDate(); j++) {
        days.push(new Date(year, month, j));
      }
      
      months.push({ year, month, days });
    }
    
    return months;
  }, []);
  
  // Generate calendar days for new booking modal
  const newBookingCalendarDays = useMemo(() => {
    const { year, month } = newBookingCalendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Sunday
    
    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    
    return days;
  }, [newBookingCalendarMonth]);
  
  // Jump to a specific date
  const jumpToDate = (date: Date) => {
    const newStart = new Date(date);
    newStart.setDate(newStart.getDate() - 3); // Show 3 days before selected date
    setStartDate(newStart);
    setShowDatePicker(false);
  };

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/admin/bookings");
      const data = await res.json();
      
      const mapped = (data.bookings || []).map((b: any, idx: number) => ({
        id: b.Booking_ID || `booking-${idx}`,
        guestName: [b.firstName, b.lastName].filter(Boolean).join(" ") || "Guest",
        room: b.room || "",
        property: b.property || "",
        checkIn: b.checkIn || "",
        checkOut: b.checkOut || "",
        nights: parseInt(b.nights) || 0,
        source: b.source || "Direct",
        status: b.status || "confirmed",
        email: b.email || "",
        phone: b.phone || "",
        rowIndex: idx,
        firstName: b.firstName || "",
        lastName: b.lastName || "",
        country: b.country || "",
        language: b.language || "",
        notes: b.notes || "",
      }));
      
      setBookings(mapped);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Generate dates for display
  const dates = useMemo(() => {
    const result = [];
    const current = new Date(startDate);
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [startDate]);

  // Check if a room has a booking on a specific date
  const getBookingForRoomDate = (room: string, date: Date): Booking | null => {
    const dateStr = toDateStr(date);
    
    for (const booking of bookings) {
      if (!booking.checkIn || !booking.checkOut) continue;
      
      const bookingRooms = parseRoomNames(booking.room);
      const isRoomMatch = bookingRooms.some(
        r => r.toLowerCase() === room.toLowerCase()
      );
      
      if (!isRoomMatch) continue;
      
      const checkInStr = booking.checkIn.split("T")[0];
      const checkOutStr = booking.checkOut.split("T")[0];
      
      // Compare as strings to avoid timezone issues
      if (dateStr >= checkInStr && dateStr < checkOutStr) {
        return booking;
      }
    }
    return null;
  };

  // Get booking span (for visual display)
  const getBookingSpan = (booking: Booking, room: string, startIdx: number): number => {
    if (!booking.checkIn || !booking.checkOut) return 1;
    
    const checkOutStr = booking.checkOut.split("T")[0];
    let span = 0;
    
    for (let i = startIdx; i < dates.length; i++) {
      const dateStr = toDateStr(dates[i]);
      if (dateStr < checkOutStr) {
        span++;
      } else {
        break;
      }
    }
    
    return Math.max(1, span);
  };

  // Check if date is start of booking
  const isBookingStart = (booking: Booking, date: Date): boolean => {
    if (!booking.checkIn) return false;
    const checkInStr = booking.checkIn.split("T")[0];
    const dateStr = toDateStr(date);
    return dateStr === checkInStr;
  };

  // Navigation
  const navigateWeek = (direction: number) => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setStartDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    today.setDate(today.getDate() - 3);
    setStartDate(today);
  };

  // Handle cell click (for new booking)
  const handleCellClick = (room: string, date: Date) => {
    const existingBooking = getBookingForRoomDate(room, date);
    if (existingBooking) {
      setSelectedBooking(existingBooking);
      setIsEditing(false);
      return;
    }
    
    const dateStr = toDateStr(date);
    setNewBooking({ room, date: dateStr });
    setNewBookingForm({
      firstName: "",
      lastName: "",
      checkIn: dateStr,
      checkOut: "",
      email: "",
      phone: "",
      country: "",
      language: "",
      notes: "",
      source: "Direct",
      room: room,
      isBlackout: false,
      totalEur: "",
      ratePerNight: "",
    });
    // Reset calendar to the clicked date's month and set to select check-out
    setNewBookingCalendarMonth({ year: date.getFullYear(), month: date.getMonth() });
    setSelectingDate("checkOut");
  };

  // Save new booking
  const saveNewBooking = async () => {
    if (!newBookingForm.checkIn || !newBookingForm.checkOut) {
      alert("Please select check-in and check-out dates");
      return;
    }
    
    if (!newBookingForm.isBlackout && !newBookingForm.firstName) {
      alert("Please enter guest name");
      return;
    }

    setSavingBooking(true);
    
    try {
      const property = RIAD_ROOMS.includes(newBookingForm.room) ? "The Riad" : "The Douaria";
      
      const checkIn = new Date(newBookingForm.checkIn);
      const checkOut = new Date(newBookingForm.checkOut);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: newBookingForm.isBlackout ? "BLOCKED" : newBookingForm.firstName,
          last_name: newBookingForm.isBlackout ? "" : newBookingForm.lastName,
          email: newBookingForm.email,
          phone: newBookingForm.phone,
          country: newBookingForm.country,
          language: newBookingForm.language,
          notes: newBookingForm.notes,
          check_in: newBookingForm.checkIn,
          check_out: newBookingForm.checkOut,
          nights: nights.toString(),
          room: newBookingForm.room,
          property: property,
          source: newBookingForm.isBlackout ? "Blocked" : newBookingForm.source,
          status: newBookingForm.isBlackout ? "blocked" : "confirmed",
          rate_per_night: newBookingForm.ratePerNight,
          total_eur: newBookingForm.totalEur,
        }),
      });

      if (res.ok) {
        await fetchBookings();
        setNewBooking(null);
        // Reset form
        setNewBookingForm({
          firstName: "",
          lastName: "",
          checkIn: "",
          checkOut: "",
          email: "",
          phone: "",
          country: "",
          language: "",
          notes: "",
          source: "Direct",
          room: "",
          isBlackout: false,
          totalEur: "",
          ratePerNight: "",
        });
      } else {
        const errorData = await res.json();
        alert("Failed to save booking: " + (errorData.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error saving booking:", error);
      alert("Failed to save booking");
    } finally {
      setSavingBooking(false);
    }
  };

  // Start editing a booking
  const startEditing = () => {
    if (!selectedBooking) return;
    setEditForm({
      firstName: selectedBooking.firstName || selectedBooking.guestName.split(" ")[0] || "",
      lastName: selectedBooking.lastName || selectedBooking.guestName.split(" ").slice(1).join(" ") || "",
      checkIn: selectedBooking.checkIn,
      checkOut: selectedBooking.checkOut,
      email: selectedBooking.email || "",
      phone: selectedBooking.phone || "",
      source: selectedBooking.source,
      room: selectedBooking.room,
      country: selectedBooking.country || "",
      language: selectedBooking.language || "",
      notes: selectedBooking.notes || "",
    });
    setIsEditing(true);
  };

  // Save edited booking
  const saveEditedBooking = async () => {
    if (!selectedBooking || selectedBooking.rowIndex === undefined) {
      alert("Cannot update booking - missing row index");
      return;
    }

    if (!editForm.firstName || !editForm.checkIn || !editForm.checkOut) {
      alert("Please fill in required fields (name, check-in, check-out)");
      return;
    }

    setSavingBooking(true);

    try {
      const property = RIAD_ROOMS.includes(editForm.room) ? "The Riad" : "The Douaria";
      const checkIn = new Date(editForm.checkIn);
      const checkOut = new Date(editForm.checkOut);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: selectedBooking.rowIndex,
          first_name: editForm.firstName,
          last_name: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone,
          check_in: editForm.checkIn,
          check_out: editForm.checkOut,
          nights: nights.toString(),
          room: editForm.room,
          property: property,
          source: editForm.source,
          country: editForm.country,
          language: editForm.language,
          notes: editForm.notes,
        }),
      });

      if (res.ok) {
        setSelectedBooking(null);
        setIsEditing(false);
        await fetchBookings();
      } else {
        const errorData = await res.json();
        alert("Failed to update booking: " + (errorData.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Failed to update booking");
    } finally {
      setSavingBooking(false);
    }
  };

  // Delete booking
  const deleteBooking = async () => {
    if (!selectedBooking || selectedBooking.rowIndex === undefined) {
      alert("Cannot delete booking - missing row index");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the booking for ${selectedBooking.guestName}?`
    );
    
    if (!confirmDelete) return;

    setDeletingBooking(true);

    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: selectedBooking.rowIndex,
        }),
      });

      if (res.ok) {
        setSelectedBooking(null);
        setIsEditing(false);
        await fetchBookings();
      } else {
        const errorData = await res.json();
        alert("Failed to delete booking: " + (errorData.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error deleting booking:", error);
      alert("Failed to delete booking");
    } finally {
      setDeletingBooking(false);
    }
  };

  // Import handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setImportError(null);
    setImportResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setImportError(data.error || "Upload failed");
        return;
      }

      setImportResults({
        ...data.results,
        source: data.source,
      });
      
      // Refresh bookings after import
      await fetchBookings();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    const fileName = file?.name.toLowerCase() || "";
    if (file && (fileName.endsWith(".csv") || fileName.endsWith(".xls") || fileName.endsWith(".xlsx"))) {
      uploadFile(file);
    } else {
      setImportError("Please upload a CSV, XLS, or XLSX file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const openImportModal = (source: "booking" | "airbnb") => {
    setImportSource(source);
    setImportResults(null);
    setImportError(null);
    setShowImportModal(true);
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-black/40 text-[13px]">Loading calendar...</div>
      </div>
    );
  }

  return (
    <PasswordGate>
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06]">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-[22px] text-black/90">Riad di Siena</h1>
              <p className="text-[11px] text-black/40 mt-1">Operations Dashboard</p>
            </div>
            
            {/* Import Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => openImportModal("booking")}
                className="flex items-center gap-2 px-4 py-2 bg-[#89CFF0]/20 hover:bg-[#89CFF0]/30 text-[#1a4a6e] rounded-lg transition-colors text-[13px] font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import Booking.com
              </button>
              <button
                onClick={() => openImportModal("airbnb")}
                className="flex items-center gap-2 px-4 py-2 bg-[#E8A9A9]/20 hover:bg-[#E8A9A9]/30 text-[#6b3a3a] rounded-lg transition-colors text-[13px] font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import Airbnb
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="bg-white border-b border-black/[0.06] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 hover:bg-black/[0.04] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-black/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 text-[13px] font-medium text-black/70 hover:bg-black/[0.04] rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 hover:bg-black/[0.04] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-black/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* Date Picker */}
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-4 py-2 border border-black/[0.1] rounded-lg hover:bg-black/[0.02] transition-colors"
            >
              <svg className="w-4 h-4 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[14px] font-medium text-black/80">
                {dates[0]?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {" – "}
                {dates[DAYS_TO_SHOW - 1]?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              <svg className={`w-4 h-4 text-black/40 transition-transform ${showDatePicker ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Date Picker Dropdown */}
            {showDatePicker && (
              <div 
                ref={datePickerRef}
                className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-black/[0.1] shadow-xl z-50"
                style={{ width: '460px' }}
              >
                {/* Months grid */}
                <div className="p-4 max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {datePickerMonths.slice(0, 12).map((monthData, monthIdx) => {
                      const monthName = new Date(monthData.year, monthData.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      // Build proper grid
                      const firstDayOfMonth = new Date(monthData.year, monthData.month, 1);
                      const lastDayOfMonth = new Date(monthData.year, monthData.month + 1, 0);
                      const startDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
                      
                      const cells: (number | null)[] = [];
                      for (let i = 0; i < startDay; i++) cells.push(null);
                      for (let d = 1; d <= lastDayOfMonth.getDate(); d++) cells.push(d);
                      while (cells.length % 7 !== 0) cells.push(null);
                      
                      return (
                        <div key={monthIdx} style={{ width: '196px' }}>
                          <div className="text-[12px] font-medium text-black/80 mb-2 text-center">
                            {monthName}
                          </div>
                          <div className="grid grid-cols-7 text-center">
                            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day, i) => (
                              <div key={i} className="text-[9px] text-black/30 font-medium py-1">
                                {day}
                              </div>
                            ))}
                            {cells.map((dayNum, idx) => {
                              if (dayNum === null) {
                                return <div key={idx} className="w-7 h-7" />;
                              }
                              const thisDate = new Date(monthData.year, monthData.month, dayNum);
                              const isToday = thisDate.toDateString() === today.toDateString();
                              const isInView = thisDate >= dates[0] && thisDate <= dates[DAYS_TO_SHOW - 1];
                              
                              return (
                                <button
                                  key={idx}
                                  onClick={() => jumpToDate(thisDate)}
                                  className={`
                                    w-7 h-7 text-[11px] rounded-md transition-colors
                                    hover:bg-black/[0.08] cursor-pointer
                                    ${isToday ? "bg-blue-500 text-white font-semibold hover:bg-blue-600" : ""}
                                    ${isInView && !isToday ? "bg-blue-100 text-blue-600" : ""}
                                    ${!isToday && !isInView ? "text-black/70" : ""}
                                  `}
                                >
                                  {dayNum}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#89CFF0]"></div>
              <span className="text-black/50">Booking.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#E8A9A9]"></div>
              <span className="text-black/50">Airbnb</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#A3B18A]"></div>
              <span className="text-black/50">Direct</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#4a4a4a]"></div>
              <span className="text-black/50">Blocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-8">
        <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
          <div ref={scrollRef} className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1400px] table-fixed">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white border-b border-r border-black/[0.06] p-3 text-left text-[11px] font-medium text-black/50 uppercase tracking-wide w-32">
                    Room
                  </th>
                  {dates.map((date, idx) => (
                    <th
                      key={idx}
                      className={`border-b border-r border-black/[0.06] p-2 text-center w-[80px] ${
                        isToday(date) ? "bg-black/[0.04]" : isWeekend(date) ? "bg-black/[0.02]" : ""
                      }`}
                    >
                      <div className="text-[10px] text-black/40 uppercase">
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div className={`text-[13px] font-medium ${isToday(date) ? "text-black" : "text-black/70"}`}>
                        {date.getDate()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* The Riad */}
                <tr>
                  <td colSpan={dates.length + 1} className="bg-black/[0.02] px-3 py-2 border-b border-black/[0.06]">
                    <span className="text-[10px] font-medium text-black/50 uppercase tracking-wide">The Riad</span>
                  </td>
                </tr>
                {RIAD_ROOMS.map((room) => (
                  <tr key={room}>
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-black/[0.06] p-3 text-[13px] font-medium text-black/80">
                      {room}
                    </td>
                    {(() => {
                      const cells: React.ReactNode[] = [];
                      let skipUntil = -1;
                      
                      dates.forEach((date, idx) => {
                        // Skip cells covered by previous booking's colspan
                        if (idx < skipUntil) {
                          return;
                        }
                        
                        const booking = getBookingForRoomDate(room, date);
                        const isStart = booking && isBookingStart(booking, date);
                        const span = isStart ? getBookingSpan(booking!, room, idx) : 1;
                        
                        if (isStart && span > 1) {
                          skipUntil = idx + span;
                        }
                        
                        cells.push(
                          <td
                            key={idx}
                            colSpan={isStart ? span : 1}
                            className={`border-b border-r border-black/[0.06] p-1 h-14 ${
                              isToday(date) ? "bg-black/[0.04]" : isWeekend(date) ? "bg-black/[0.02]" : ""
                            } ${!booking ? "cursor-pointer hover:bg-black/[0.04]" : ""}`}
                            onClick={() => !booking && handleCellClick(room, date)}
                          >
                            {isStart && booking && (
                              <div
                                className={`${getSourceColor(booking.source)} ${getSourceTextColor(booking.source)} rounded px-2 py-1 text-[11px] font-medium truncate cursor-pointer hover:opacity-90 transition-opacity`}
                                style={{ minHeight: "36px" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBooking(booking);
                                  setIsEditing(false);
                                }}
                              >
                                <div className="truncate">{booking.guestName}</div>
                                <div className="text-[10px] opacity-75">{booking.nights}n</div>
                              </div>
                            )}
                          </td>
                        );
                      });
                      
                      return cells;
                    })()}
                  </tr>
                ))}

                {/* The Douaria */}
                <tr>
                  <td colSpan={dates.length + 1} className="bg-black/[0.02] px-3 py-2 border-b border-black/[0.06]">
                    <span className="text-[10px] font-medium text-black/50 uppercase tracking-wide">The Douaria</span>
                  </td>
                </tr>
                {DOUARIA_ROOMS.map((room) => (
                  <tr key={room}>
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-black/[0.06] p-3 text-[13px] font-medium text-black/80">
                      {room}
                    </td>
                    {(() => {
                      const cells: React.ReactNode[] = [];
                      let skipUntil = -1;
                      
                      dates.forEach((date, idx) => {
                        // Skip cells covered by previous booking's colspan
                        if (idx < skipUntil) {
                          return;
                        }
                        
                        const booking = getBookingForRoomDate(room, date);
                        const isStart = booking && isBookingStart(booking, date);
                        const span = isStart ? getBookingSpan(booking!, room, idx) : 1;
                        
                        if (isStart && span > 1) {
                          skipUntil = idx + span;
                        }
                        
                        cells.push(
                          <td
                            key={idx}
                            colSpan={isStart ? span : 1}
                            className={`border-b border-r border-black/[0.06] p-1 h-14 ${
                              isToday(date) ? "bg-black/[0.04]" : isWeekend(date) ? "bg-black/[0.02]" : ""
                            } ${!booking ? "cursor-pointer hover:bg-black/[0.04]" : ""}`}
                            onClick={() => !booking && handleCellClick(room, date)}
                          >
                            {isStart && booking && (
                              <div
                                className={`${getSourceColor(booking.source)} ${getSourceTextColor(booking.source)} rounded px-2 py-1 text-[11px] font-medium truncate cursor-pointer hover:opacity-90 transition-opacity`}
                                style={{ minHeight: "36px" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBooking(booking);
                                  setIsEditing(false);
                                }}
                              >
                                <div className="truncate">{booking.guestName}</div>
                                <div className="text-[10px] opacity-75">{booking.nights}n</div>
                              </div>
                            )}
                          </td>
                        );
                      });
                      
                      return cells;
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View/Edit Booking Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-black/[0.06]">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-[18px] text-black/90">
                  {isEditing ? "Edit Booking" : "Booking Details"}
                </h2>
                <button
                  onClick={() => {
                    setSelectedBooking(null);
                    setIsEditing(false);
                  }}
                  className="p-2 hover:bg-black/[0.04] rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-black/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {isEditing ? (
                <>
                  {/* Edit Form */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                      Room
                    </label>
                    <select
                      value={editForm.room}
                      onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                      className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                    >
                      {ALL_ROOMS.map((room) => (
                        <option key={room} value={room}>{room}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                      Source
                    </label>
                    <select
                      value={editForm.source}
                      onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                      className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                    >
                      {BOOKING_SOURCES.map((src) => (
                        <option key={src} value={src}>{src}</option>
                      ))}
                      <option value="Booking.com">Booking.com</option>
                      <option value="Airbnb">Airbnb</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                        Check-in *
                      </label>
                      <input
                        type="date"
                        value={editForm.checkIn}
                        onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                        Check-out *
                      </label>
                      <input
                        type="date"
                        value={editForm.checkOut}
                        onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                      />
                    </div>
                  </div>
                  
                  {/* Country & Language */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                        Country
                      </label>
                      <input
                        type="text"
                        value={editForm.country}
                        onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                        Language
                      </label>
                      <input
                        type="text"
                        value={editForm.language}
                        onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30"
                      />
                    </div>
                  </div>
                  
                  {/* Notes */}
                  <div>
                    <label className="block text-[11px] font-medium text-black/50 uppercase tracking-wide mb-1.5">
                      Notes
                    </label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-black/[0.1] rounded-lg text-[13px] focus:outline-none focus:border-black/30 resize-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* View Mode */}
                  <div className="flex items-start gap-4">
                    <div className={`${getSourceColor(selectedBooking.source)} w-12 h-12 rounded-lg flex items-center justify-center`}>
                      <span className={`${getSourceTextColor(selectedBooking.source)} font-medium text-[15px]`}>
                        {selectedBooking.guestName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-[15px] font-medium text-black/90">{selectedBooking.guestName}</h3>
                      <p className="text-[13px] text-black/50">{selectedBooking.room}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Check-in</div>
                      <div className="text-[13px] text-black/80">{selectedBooking.checkIn}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Check-out</div>
                      <div className="text-[13px] text-black/80">{selectedBooking.checkOut}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Nights</div>
                      <div className="text-[13px] text-black/80">{selectedBooking.nights}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Source</div>
                      <div className="text-[13px] text-black/80">{selectedBooking.source}</div>
                    </div>
                    {selectedBooking.email && (
                      <div className="col-span-2">
                        <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Email</div>
                        <div className="text-[13px] text-black/80">{selectedBooking.email}</div>
                      </div>
                    )}
                    {selectedBooking.phone && (
                      <div className="col-span-2">
                        <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Phone</div>
                        <div className="text-[13px] text-black/80">{selectedBooking.phone}</div>
                      </div>
                    )}
                    {selectedBooking.country && (
                      <div>
                        <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Country</div>
                        <div className="text-[13px] text-black/80">{selectedBooking.country}</div>
                      </div>
                    )}
                    {selectedBooking.language && (
                      <div>
                        <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Language</div>
                        <div className="text-[13px] text-black/80">{selectedBooking.language}</div>
                      </div>
                    )}
                    {selectedBooking.notes && (
                      <div className="col-span-2">
                        <div className="text-[11px] text-black/40 uppercase tracking-wide mb-1">Notes</div>
                        <div className="text-[13px] text-black/80 whitespace-pre-wrap">{selectedBooking.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Send Confirmation Section - Only for Direct bookings */}
                  {(selectedBooking.email || selectedBooking.phone) && 
                   selectedBooking.status !== "blocked" && 
                   !selectedBooking.source.toLowerCase().includes("booking") &&
                   !selectedBooking.source.toLowerCase().includes("airbnb") && (
                    <div className="mt-4 pt-4 border-t border-black/[0.06]">
                      <div className="text-[11px] font-medium text-black/50 uppercase tracking-wide mb-3">
                        Send Confirmation
                      </div>
                      
                      {/* Include Payment Link Checkbox */}
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includePaymentLink}
                          onChange={(e) => setIncludePaymentLink(e.target.checked)}
                          className="w-4 h-4 rounded border-black/20 text-black focus:ring-black/20"
                        />
                        <span className="text-[12px] text-black/60">Include PayPal payment link</span>
                      </label>
                      
                      <div className="flex gap-2">
                        {selectedBooking.email && (
                          <button
                            onClick={() => {
                              const firstName = selectedBooking.firstName || selectedBooking.guestName.split(" ")[0];
                              const subject = encodeURIComponent(`Booking Confirmation - Riad di Siena`);
                              const paymentSection = includePaymentLink 
                                ? `\n\nTo complete your booking, please make your payment via PayPal:\nhttps://www.paypal.com/paypalme/riaddisiena\n` 
                                : '';
                              const body = encodeURIComponent(
`Dear ${firstName},

Thank you for your booking at Riad di Siena!

Here are your reservation details:

Room: ${selectedBooking.room}
Check-in: ${new Date(selectedBooking.checkIn).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
Check-out: ${new Date(selectedBooking.checkOut).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
Nights: ${selectedBooking.nights}${paymentSection}

We look forward to welcoming you!

Warm regards,
Riad di Siena`
                              );
                              window.open(`mailto:${selectedBooking.email}?subject=${subject}&body=${body}`, '_blank');
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-black/[0.04] hover:bg-black/[0.08] rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4 text-black/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[12px] font-medium text-black/60">Email</span>
                          </button>
                        )}

                        {selectedBooking.phone && (
                          <button
                            onClick={() => {
                              const firstName = selectedBooking.firstName || selectedBooking.guestName.split(" ")[0];
                              const phone = (selectedBooking.phone || "").replace(/[^0-9+]/g, "");
                              const paymentSection = includePaymentLink 
                                ? `\n\n💳 *Payment link:*\nhttps://www.paypal.com/paypalme/riaddisiena` 
                                : '';
                              const message = encodeURIComponent(
`Hello ${firstName}! 🌿

Your booking at *Riad di Siena* is confirmed:

🏠 *${selectedBooking.room}*
📅 ${new Date(selectedBooking.checkIn).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(selectedBooking.checkOut).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
🌙 ${selectedBooking.nights} night${selectedBooking.nights > 1 ? 's' : ''}${paymentSection}

We look forward to welcoming you! ✨`
                              );
                              window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            <span className="text-[12px] font-medium text-[#25D366]">WhatsApp</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 border-t border-black/[0.06] flex justify-between">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-[13px] font-medium text-black/60 hover:bg-black/[0.04] rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditedBooking}
                    disabled={savingBooking}
                    className="px-6 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50"
                  >
                    {savingBooking ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={deleteBooking}
                    disabled={deletingBooking}
                    className="px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingBooking ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={startEditing}
                    className="px-6 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-black/80 transition-colors"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Booking Modal - Riad Brand Design */}
      {newBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#f8f5f0] shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
            {/* Header - Fixed */}
            <div className="p-6 border-b border-foreground/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-[20px] text-foreground/90">New Booking</h2>
                <button
                  onClick={() => setNewBooking(null)}
                  className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Content - Scrollable */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Blackout Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBookingForm.isBlackout}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, isBlackout: e.target.checked })}
                  className="w-4 h-4 accent-foreground"
                />
                <span className="text-[13px] text-foreground/70">Block dates (no guest)</span>
              </label>

              {!newBookingForm.isBlackout && (
                <>
                  {/* Name Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={newBookingForm.firstName}
                        onChange={(e) => setNewBookingForm({ ...newBookingForm, firstName: e.target.value })}
                        className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 focus:outline-none focus:border-foreground/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={newBookingForm.lastName}
                        onChange={(e) => setNewBookingForm({ ...newBookingForm, lastName: e.target.value })}
                        className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 focus:outline-none focus:border-foreground/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Source */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                      Source
                    </label>
                    <select
                      value={newBookingForm.source}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, source: e.target.value })}
                      className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 focus:outline-none focus:border-foreground/40 transition-colors cursor-pointer"
                    >
                      {BOOKING_SOURCES.map((src) => (
                        <option key={src} value={src}>{src}</option>
                      ))}
                    </select>
                  </div>

                  {/* Email & Phone Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={newBookingForm.email}
                        onChange={(e) => setNewBookingForm({ ...newBookingForm, email: e.target.value })}
                        className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 focus:outline-none focus:border-foreground/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={newBookingForm.phone}
                        onChange={(e) => setNewBookingForm({ ...newBookingForm, phone: e.target.value })}
                        className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 focus:outline-none focus:border-foreground/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Country & Language Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                        Country
                      </label>
                      <input
                        type="text"
                        value={newBookingForm.country}
                        onChange={(e) => setNewBookingForm({ ...newBookingForm, country: e.target.value })}
                        placeholder="e.g. France"
                        className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                        Language
                      </label>
                      <select
                        value={newBookingForm.language}
                        onChange={(e) => setNewBookingForm({ ...newBookingForm, language: e.target.value })}
                        className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 focus:outline-none focus:border-foreground/40 transition-colors cursor-pointer"
                      >
                        <option value="">Select...</option>
                        <option value="English">English</option>
                        <option value="French">French</option>
                        <option value="Spanish">Spanish</option>
                        <option value="German">German</option>
                        <option value="Italian">Italian</option>
                        <option value="Arabic">Arabic</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                      Notes / Comments
                    </label>
                    <textarea
                      value={newBookingForm.notes}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Special requests, arrival details, etc."
                      className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors resize-none"
                    />
                  </div>

                  {/* Agreed Rates Section */}
                  <div className="pt-4 border-t border-foreground/10">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-4">
                      Agreed Rates
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                          Rate per Night (€)
                        </label>
                        <input
                          type="number"
                          value={newBookingForm.ratePerNight}
                          onChange={(e) => setNewBookingForm({ ...newBookingForm, ratePerNight: e.target.value })}
                          placeholder="e.g. 150"
                          className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                          Total (€)
                        </label>
                        <input
                          type="number"
                          value={newBookingForm.totalEur}
                          onChange={(e) => setNewBookingForm({ ...newBookingForm, totalEur: e.target.value })}
                          placeholder="e.g. 450"
                          className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors"
                        />
                      </div>
                    </div>
                    {newBookingForm.checkIn && newBookingForm.checkOut && newBookingForm.ratePerNight && (
                      <div className="mt-3 text-[11px] text-foreground/40">
                        {(() => {
                          const nights = Math.ceil((new Date(newBookingForm.checkOut).getTime() - new Date(newBookingForm.checkIn).getTime()) / (1000 * 60 * 60 * 24));
                          const calculated = nights * parseFloat(newBookingForm.ratePerNight);
                          return nights > 0 ? `${nights} night${nights > 1 ? 's' : ''} × €${newBookingForm.ratePerNight} = €${calculated.toFixed(0)}` : '';
                        })()}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Room */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-foreground/40 mb-2">
                  Room
                </label>
                <select
                  value={newBookingForm.room}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, room: e.target.value })}
                  className="w-full bg-transparent border-b border-foreground/20 pb-3 text-[14px] text-foreground/90 focus:outline-none focus:border-foreground/40 transition-colors cursor-pointer"
                >
                  {ALL_ROOMS.map((room) => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>

              {/* Calendar Date Picker */}
              <div className="border-t border-foreground/10 pt-6">
                {/* Step Indicator */}
                <div className="text-[10px] uppercase tracking-[0.15em] text-foreground/40 mb-4">
                  {selectingDate === "checkIn" ? "Step 1 of 2 — Select Check-in" : "Step 2 of 2 — Select Check-out"}
                </div>

                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => {
                      const { year, month } = newBookingCalendarMonth;
                      const newMonth = month === 0 ? 11 : month - 1;
                      const newYear = month === 0 ? year - 1 : year;
                      setNewBookingCalendarMonth({ year: newYear, month: newMonth });
                    }}
                    className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10 4l-4 4 4 4" />
                    </svg>
                  </button>
                  <span className="text-[14px] text-foreground/80">
                    {new Date(newBookingCalendarMonth.year, newBookingCalendarMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => {
                      const { year, month } = newBookingCalendarMonth;
                      const newMonth = month === 11 ? 0 : month + 1;
                      const newYear = month === 11 ? year + 1 : year;
                      setNewBookingCalendarMonth({ year: newYear, month: newMonth });
                    }}
                    className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7">
                  {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => (
                    <div key={day} className="h-10 flex items-center justify-center text-[11px] text-foreground/40">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 border-t border-l border-foreground/10">
                  {newBookingCalendarDays.map((date, idx) => {
                    if (!date) {
                      return <div key={`empty-${idx}`} className="h-10 border-b border-r border-foreground/10" />;
                    }
                    
                    const dateStr = toDateStr(date);
                    const isCheckIn = newBookingForm.checkIn === dateStr;
                    const isCheckOut = newBookingForm.checkOut === dateStr;
                    const isSelected = isCheckIn || isCheckOut;
                    const isInRange = newBookingForm.checkIn && newBookingForm.checkOut && 
                      dateStr > newBookingForm.checkIn && dateStr < newBookingForm.checkOut;
                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                    
                    return (
                      <button
                        key={dateStr}
                        disabled={isPast}
                        onClick={() => {
                          if (selectingDate === "checkIn") {
                            setNewBookingForm({ ...newBookingForm, checkIn: dateStr, checkOut: "" });
                            setSelectingDate("checkOut");
                          } else {
                            if (dateStr > newBookingForm.checkIn) {
                              setNewBookingForm({ ...newBookingForm, checkOut: dateStr });
                              setSelectingDate("checkIn");
                            }
                          }
                        }}
                        className={`h-10 flex items-center justify-center text-[13px] border-b border-r border-foreground/10 transition-colors
                          ${isPast ? "text-foreground/20 cursor-not-allowed" : "hover:bg-foreground/5 cursor-pointer text-foreground/70"}
                          ${isSelected ? "bg-foreground text-[#f8f5f0]" : ""}
                          ${isInRange ? "bg-foreground/10" : ""}
                        `}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 mt-5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-foreground" />
                    <span className="text-[10px] text-foreground/40 uppercase tracking-[0.1em]">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-foreground/15" />
                    <span className="text-[10px] text-foreground/40 uppercase tracking-[0.1em]">Unavailable</span>
                  </div>
                </div>

                {/* Selected Dates Display */}
                {newBookingForm.checkIn && (
                  <div className="mt-4 pt-4 border-t border-foreground/10 text-[12px] text-foreground/60">
                    {new Date(newBookingForm.checkIn + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {newBookingForm.checkOut && (
                      <> — {new Date(newBookingForm.checkOut + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Fixed */}
            <div className="p-6 border-t border-foreground/10 flex gap-4 flex-shrink-0">
              <button
                onClick={() => setNewBooking(null)}
                className="flex-1 py-3 text-[11px] uppercase tracking-[0.08em] font-medium border border-foreground/20 text-foreground/70 hover:border-foreground/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveNewBooking}
                disabled={savingBooking}
                className="flex-1 py-3 text-[11px] uppercase tracking-[0.08em] font-medium bg-foreground text-[#f8f5f0] hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {savingBooking ? "Saving..." : newBookingForm.isBlackout ? "Block Dates" : "Add Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-black/[0.06]">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-[18px] text-black/90">
                  Import {importSource === "booking" ? "Booking.com" : "Airbnb"} Export
                </h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-2 hover:bg-black/[0.04] rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-black/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  isDragging
                    ? importSource === "booking"
                      ? "border-[#89CFF0] bg-[#89CFF0]/10"
                      : "border-[#E8A9A9] bg-[#E8A9A9]/10"
                    : "border-black/[0.1] hover:border-black/20"
                }`}
              >
                {isUploading ? (
                  <div className="text-[13px] text-black/60">Uploading...</div>
                ) : importResults ? (
                  <div className="space-y-3">
                    <div className="text-[15px] font-medium text-black/90">Import Complete</div>
                    <div className="grid grid-cols-2 gap-2 text-[13px]">
                      <div className="text-emerald-600">Added: {importResults.added}</div>
                      <div className="text-amber-600">Updated: {importResults.updated}</div>
                      <div className="text-black/50">Unchanged: {importResults.unchanged}</div>
                      <div className="text-red-600">Cancelled: {importResults.cancelled}</div>
                    </div>
                    <button
                      onClick={() => {
                        setImportResults(null);
                        setShowImportModal(false);
                      }}
                      className="mt-4 px-4 py-2 bg-black text-white text-[13px] font-medium rounded-lg"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
                      importSource === "booking" ? "bg-[#89CFF0]/20" : "bg-[#E8A9A9]/20"
                    }`}>
                      <svg className={`w-6 h-6 ${
                        importSource === "booking" ? "text-[#1a4a6e]" : "text-[#6b3a3a]"
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <p className="text-[13px] text-black/60 mb-2">Drag and drop your file here</p>
                    <p className="text-[11px] text-black/40 mb-4">CSV, XLS, or XLSX</p>
                    <label className={`inline-block px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer ${
                      importSource === "booking"
                        ? "bg-[#89CFF0]/20 text-[#1a4a6e] hover:bg-[#89CFF0]/30"
                        : "bg-[#E8A9A9]/20 text-[#6b3a3a] hover:bg-[#E8A9A9]/30"
                    }`}>
                      Browse Files
                      <input
                        type="file"
                        accept=".csv,.xls,.xlsx"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  </>
                )}

                {importError && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg text-[13px] text-red-600">
                    {importError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PasswordGate>
  );
}
