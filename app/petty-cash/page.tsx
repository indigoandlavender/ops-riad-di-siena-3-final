"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Entry {
  id: string;
  date: string;
  person: string;
  type: "advance" | "return";
  amount: number;
  notes: string;
}

interface Note {
  id: string;
  date: string;
  note: string;
}

interface Balances {
  zahra: { given: number; returned: number; spent: number; balance: number };
  mouad: { given: number; returned: number; spent: number; balance: number };
}

export default function PettyCashPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [person, setPerson] = useState("zahra");
  const [type, setType] = useState<"advance" | "return">("advance");
  const [amount, setAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Note form state
  const [noteText, setNoteText] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/petty-cash");
      const data = await res.json();
      setEntries(data.entries || []);
      setNotes(data.notes || []);
      setBalances(data.balances || null);
    } catch (error) {
      console.error("Error fetching petty cash:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/petty-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          person,
          type,
          amount: parseFloat(amount),
          notes: formNotes,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setAmount("");
        setFormNotes("");
        setType("advance");
        fetchData();
      }
    } catch (error) {
      console.error("Error saving entry:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/petty-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_note",
          note: noteText.trim(),
        }),
      });

      if (res.ok) {
        setShowNoteForm(false);
        setNoteText("");
        fetchData();
      }
    } catch (error) {
      console.error("Error saving note:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatDH = (n: number) => n.toLocaleString("fr-MA") + " DH";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-white/40 hover:text-white transition-colors">
              ← Admin
            </Link>
            <h1 className="text-lg font-medium">Petty Cash</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            + Record
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Balance Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Zahra */}
          <div className="bg-white/5 border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-blue-400 font-medium">Z</span>
              </div>
              <h2 className="text-xl font-medium">Zahra</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60">Given</span>
                <span className="text-green-400">+{formatDH(balances?.zahra.given || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Returned</span>
                <span className="text-amber-400">-{formatDH(balances?.zahra.returned || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Spent</span>
                <span className="text-red-400">-{formatDH(balances?.zahra.spent || 0)}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between">
                <span className="font-medium">Balance</span>
                <span className={`font-medium ${(balances?.zahra.balance || 0) < 0 ? "text-red-400" : "text-white"}`}>
                  {formatDH(balances?.zahra.balance || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Mouad */}
          <div className="bg-white/5 border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-purple-400 font-medium">M</span>
              </div>
              <h2 className="text-xl font-medium">Mouad</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60">Given</span>
                <span className="text-green-400">+{formatDH(balances?.mouad.given || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Returned</span>
                <span className="text-amber-400">-{formatDH(balances?.mouad.returned || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Spent</span>
                <span className="text-red-400">-{formatDH(balances?.mouad.spent || 0)}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between">
                <span className="font-medium">Balance</span>
                <span className={`font-medium ${(balances?.mouad.balance || 0) < 0 ? "text-red-400" : "text-white"}`}>
                  {formatDH(balances?.mouad.balance || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {notes.length > 0 && (
          <div className="mb-12">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
              Notes
            </h3>
            <div className="space-y-3">
              {notes.slice().reverse().map((note) => (
                <div
                  key={note.id}
                  className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-yellow-500 text-lg">💬</span>
                    <div className="flex-1">
                      <p className="text-white/90">{note.note}</p>
                      <p className="text-white/40 text-sm mt-1">{note.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Entries */}
        <div>
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
            Transaction History
          </h3>
          
          {entries.length === 0 ? (
            <div className="text-white/40 text-center py-8">
              No transactions recorded yet
            </div>
          ) : (
            <div className="space-y-2">
              {entries.slice().reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-3 border-b border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      entry.person === "zahra" 
                        ? "bg-blue-500/20 text-blue-400" 
                        : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {entry.person === "zahra" ? "Z" : "M"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{entry.person}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          entry.type === "advance" 
                            ? "bg-green-500/20 text-green-400" 
                            : "bg-amber-500/20 text-amber-400"
                        }`}>
                          {entry.type === "advance" ? "Given" : "Returned"}
                        </span>
                      </div>
                      <div className="text-sm text-white/40">
                        {entry.date}
                        {entry.notes && ` · ${entry.notes}`}
                      </div>
                    </div>
                  </div>
                  <div className={`font-medium ${
                    entry.type === "advance" ? "text-green-400" : "text-amber-400"
                  }`}>
                    {entry.type === "advance" ? "+" : "-"}{formatDH(entry.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Notes Bubble */}
      <button
        onClick={() => setShowNoteForm(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-yellow-500 hover:bg-yellow-400 text-black rounded-full shadow-lg flex items-center justify-center transition-colors"
        title="Add note"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Add Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-md p-6">
            <h2 className="text-lg font-medium mb-6">Record Transaction</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-transparent border border-white/20 px-4 py-3 focus:outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Person</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPerson("zahra")}
                    className={`flex-1 py-3 border transition-colors ${
                      person === "zahra"
                        ? "bg-blue-500/20 border-blue-500 text-blue-400"
                        : "border-white/20 text-white/60 hover:border-white/40"
                    }`}
                  >
                    Zahra
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerson("mouad")}
                    className={`flex-1 py-3 border transition-colors ${
                      person === "mouad"
                        ? "bg-purple-500/20 border-purple-500 text-purple-400"
                        : "border-white/20 text-white/60 hover:border-white/40"
                    }`}
                  >
                    Mouad
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setType("advance")}
                    className={`flex-1 py-3 border transition-colors ${
                      type === "advance"
                        ? "bg-green-500/20 border-green-500 text-green-400"
                        : "border-white/20 text-white/60 hover:border-white/40"
                    }`}
                  >
                    I Gave
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("return")}
                    className={`flex-1 py-3 border transition-colors ${
                      type === "return"
                        ? "bg-amber-500/20 border-amber-500 text-amber-400"
                        : "border-white/20 text-white/60 hover:border-white/40"
                    }`}
                  >
                    They Returned
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Amount (DH)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                  className="w-full bg-transparent border border-white/20 px-4 py-3 focus:outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Notes (optional)</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="January float"
                  className="w-full bg-transparent border border-white/20 px-4 py-3 focus:outline-none focus:border-white/40"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 border border-white/20 text-white/60 hover:border-white/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !amount}
                  className="flex-1 py-3 bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-md p-6">
            <h2 className="text-lg font-medium mb-6 flex items-center gap-2">
              <span className="text-yellow-500">💬</span>
              Add Note
            </h2>
            
            <form onSubmit={handleNoteSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Note</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Remind me to top up Zahra's float next week..."
                  rows={4}
                  className="w-full bg-transparent border border-white/20 px-4 py-3 focus:outline-none focus:border-white/40 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoteForm(false)}
                  className="flex-1 py-3 border border-white/20 text-white/60 hover:border-white/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !noteText.trim()}
                  className="flex-1 py-3 bg-yellow-500 text-black font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
