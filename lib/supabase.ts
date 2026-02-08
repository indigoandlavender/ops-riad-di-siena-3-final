import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service-role client for server-side operations (full CRUD)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================
// Types
// ============================================================

export interface MasterGuest {
  id?: number;
  booking_id: string;
  source: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  language: string;
  property: string;
  room: string;
  check_in: string;
  check_out: string;
  nights: number | null;
  guests: number | null;
  adults: number | null;
  children: number | null;
  total_eur: number | null;
  city_tax: number | null;
  special_requests: string;
  arrival_time_stated: string;
  arrival_request_sent: string;
  arrival_confirmed: string;
  arrival_time_confirmed: string;
  read_messages: string;
  midstay_checkin: string;
  city_tax_paid: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Read helpers
// ============================================================

/** Get all guests (replaces getSheetData("Master_Guests")) */
export async function getAllGuests(): Promise<MasterGuest[]> {
  const { data, error } = await supabase
    .from("master_guests")
    .select("*")
    .order("check_in", { ascending: true });

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data || []) as MasterGuest[];
}

/** Get a single guest by booking_id */
export async function getGuestByBookingId(bookingId: string): Promise<MasterGuest | null> {
  const { data, error } = await supabase
    .from("master_guests")
    .select("*")
    .eq("booking_id", bookingId)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Supabase query failed: ${error.message}`);
  }
  return data as MasterGuest | null;
}

/** Get a single guest by internal id */
export async function getGuestById(id: number): Promise<MasterGuest | null> {
  const { data, error } = await supabase
    .from("master_guests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return data as MasterGuest | null;
}

/** Get guests by date range (for calendar views) */
export async function getGuestsByDateRange(
  startDate: string,
  endDate: string
): Promise<MasterGuest[]> {
  const { data, error } = await supabase
    .from("master_guests")
    .select("*")
    .lte("check_in", endDate)
    .gte("check_out", startDate)
    .order("check_in", { ascending: true });

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data || []) as MasterGuest[];
}

/** Get today's active guests (checking in, hosting, checking out) */
export async function getTodayGuests(today: string): Promise<MasterGuest[]> {
  const { data, error } = await supabase
    .from("master_guests")
    .select("*")
    .lte("check_in", today)
    .gte("check_out", today)
    .not("status", "in", '("cancelled","blocked")')
    .order("check_in", { ascending: true });

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data || []) as MasterGuest[];
}

// ============================================================
// Write helpers
// ============================================================

/** Insert a new guest (replaces appendToSheet) */
export async function insertGuest(
  guest: Partial<MasterGuest>
): Promise<MasterGuest> {
  const { data, error } = await supabase
    .from("master_guests")
    .insert({
      ...guest,
      created_at: guest.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return data as MasterGuest;
}

/** Insert multiple guests (batch) */
export async function insertGuests(
  guests: Partial<MasterGuest>[]
): Promise<number> {
  const now = new Date().toISOString();
  const rows = guests.map((g) => ({
    ...g,
    created_at: g.created_at || now,
    updated_at: now,
  }));

  const { error } = await supabase.from("master_guests").insert(rows);

  if (error) throw new Error(`Supabase batch insert failed: ${error.message}`);
  return rows.length;
}

/** Update a guest by booking_id (replaces updateSheetRow) */
export async function updateGuestByBookingId(
  bookingId: string,
  updates: Partial<MasterGuest>
): Promise<MasterGuest | null> {
  const { data, error } = await supabase
    .from("master_guests")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .select()
    .single();

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  return data as MasterGuest | null;
}

/** Update a guest by internal id */
export async function updateGuestById(
  id: number,
  updates: Partial<MasterGuest>
): Promise<MasterGuest | null> {
  const { data, error } = await supabase
    .from("master_guests")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  return data as MasterGuest | null;
}

/** Delete a guest by internal id (replaces deleteRow) */
export async function deleteGuestById(id: number): Promise<void> {
  const { error } = await supabase
    .from("master_guests")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

/** Delete a guest by booking_id */
export async function deleteGuestByBookingId(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("master_guests")
    .delete()
    .eq("booking_id", bookingId);

  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}
