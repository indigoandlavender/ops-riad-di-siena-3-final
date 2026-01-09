"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Advance {
  id: string;
  date: string;
  person: string;
  amount: number;
  notes: string;
}

interface Balances {
  zahra: { given: number; spent: number; balance: number };
  mouad: { given: number; spent: number; balance: number };
}

export default function PettyCashPage() {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [person, setPerson] = useState("zahra");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/petty-cash");
      const data = await res.json();
      setAdvances(data.advances || []);
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
          amount: parseFloat(amount),
          notes,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setAmount("");
        setNotes("");
        fetchData();
      }
    } catch (error) {
      console.error("Error saving advance:", error);
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
            + Add Advance
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

        {/* Recent Advances */}
        <div>
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
            Recent Advances
          </h3>
          
          {advances.length === 0 ? (
            <div className="text-white/40 text-center py-8">
              No advances recorded yet
            </div>
          ) : (
            <div className="space-y-2">
              {advances.slice().reverse().map((advance) => (
                <div
                  key={advance.id}
                  className="flex items-center justify-between py-3 border-b border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      advance.person === "zahra" 
                        ? "bg-blue-500/20 text-blue-400" 
                        : "bg-purple-500/20 text-purple-400"
                    }`}>
                      {advance.person === "zahra" ? "Z" : "M"}
                    </div>
                    <div>
                      <div className="font-medium capitalize">{advance.person}</div>
                      <div className="text-sm text-white/40">
                        {advance.date}
                        {advance.notes && ` · ${advance.notes}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-green-400 font-medium">
                    +{formatDH(advance.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Advance Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-md p-6">
            <h2 className="text-lg font-medium mb-6">Add Advance</h2>
            
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
    </div>
  );
}
