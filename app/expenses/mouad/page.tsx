"use client";

import { useState, useEffect, useRef } from "react";

const STAFF_CATEGORIES = [
  "Rent",
  "Plumbing",
  "Bobker",
  "Supplies",
  "Carpenter",
  "Internet",
  "Mason",
  "Omar",
  "AC",
  "Other",
];

interface Expense {
  expense_id: string;
  date: string;
  description: string;
  category: string;
  amount_dh: number;
  receipt_url?: string;
  created_at: string;
}

export default function MouadExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Supplies");
  const [formAmount, setFormAmount] = useState("");
  const [formReceiptUrl, setFormReceiptUrl] = useState("");
  const [formReceiptName, setFormReceiptName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    try {
      const res = await fetch("/api/expenses/staff?staff=mouad");
      const data = await res.json();
      setExpenses(data.expenses || []);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/expenses/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setFormReceiptUrl(data.url);
        setFormReceiptName(file.name);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (error) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formDescription || !formAmount) return;

    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/expenses/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff: "mouad",
          date: formDate,
          description: formDescription,
          category: formCategory,
          amount_dh: parseFloat(formAmount),
          receipt_url: formReceiptUrl || undefined,
        }),
      });

      if (res.ok) {
        // Reset form
        setFormDescription("");
        setFormAmount("");
        setFormReceiptUrl("");
        setFormReceiptName("");
        setFormCategory("Supplies");
        if (fileInputRef.current) fileInputRef.current.value = "";
        
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        await fetchExpenses();
      } else {
        alert("Failed to save expense");
      }
    } catch (error) {
      alert("Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  // Calculate this month's total
  const thisMonth = new Date().toISOString().substring(0, 7);
  const thisMonthTotal = expenses
    .filter(e => e.date.startsWith(thisMonth))
    .reduce((sum, e) => sum + e.amount_dh, 0);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-xl mx-auto px-6 py-6">
          <p className="text-[11px] uppercase tracking-[0.15em] text-stone-400">Riad di Siena</p>
          <h1 className="text-[24px] font-serif text-stone-800 mt-1">Expenses — Mouad</h1>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-8">
        
        {/* This Month Summary */}
        <div className="bg-white rounded-lg border border-stone-200 p-5 mb-6">
          <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500">This Month</p>
          <p className="text-[28px] font-serif text-stone-700 mt-1">
            {thisMonthTotal.toLocaleString()} <span className="text-[16px] text-stone-400">DH</span>
          </p>
        </div>

        {/* Add Expense Form */}
        <div className="bg-white rounded-lg border border-stone-200 p-6 mb-8">
          <h2 className="text-[14px] font-medium text-stone-800 mb-4">Add Expense</h2>
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-[13px] text-green-700">
              ✓ Expense saved
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded text-[14px] focus:outline-none focus:border-stone-400"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1">What did you buy?</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g., Gas for car"
                className="w-full px-3 py-2 border border-stone-200 rounded text-[14px] focus:outline-none focus:border-stone-400"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded text-[14px] focus:outline-none focus:border-stone-400 bg-white"
              >
                {STAFF_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1">Amount (DH)</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-stone-200 rounded text-[14px] focus:outline-none focus:border-stone-400"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1">
                Receipt Photo (optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 border border-stone-200 rounded text-[13px] text-stone-600 hover:border-stone-300 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : formReceiptName || "Upload Receipt"}
              </button>
              {formReceiptUrl && (
                <span className="ml-2 text-[12px] text-green-600">✓ Uploaded</span>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || !formDescription || !formAmount}
              className="w-full py-3 bg-stone-800 text-white text-[13px] font-medium rounded hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Expense"}
            </button>
          </form>
        </div>

        {/* Recent Expenses */}
        <div className="bg-white rounded-lg border border-stone-200">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="text-[14px] font-medium text-stone-800">Your Recent Expenses</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-stone-400">Loading...</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-stone-400">No expenses yet</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {expenses.slice(0, 20).map((expense) => (
                <div key={expense.expense_id} className="px-5 py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[14px] text-stone-700">{expense.description}</p>
                      <p className="text-[12px] text-stone-400 mt-0.5">
                        {new Date(expense.date).toLocaleDateString("en-GB", { 
                          day: "numeric", 
                          month: "short" 
                        })} · {expense.category}
                      </p>
                    </div>
                    <p className="text-[14px] font-medium text-stone-700">
                      {expense.amount_dh.toLocaleString()} DH
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
