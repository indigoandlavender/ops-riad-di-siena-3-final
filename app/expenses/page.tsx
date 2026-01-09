"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Categories that are sensitive (excluded from operations report)
// Categories that only admin sees (excluded from Operations PDF report)
const SENSITIVE_CATEGORIES = ["Rent", "Electricity", "Water", "Internet"];

// Google Sheet URL
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1qBOHt08Y5_2dn1dmBdZjKJQR9ShjacZLdLJvsK787Qo/edit";

interface Expense {
  expense_id: string;
  date: string;
  description: string;
  category: string;
  amount_dh: number;
  receipt_url: string;
  created_at: string;
  source?: string; // admin, zahra, or mouad
}

interface Summary {
  total: number;
  byCategory: Record<string, number>;
  byMonth: Record<string, number>;
  bySource?: Record<string, number>;
  count: number;
}

const CATEGORIES = [
  // Zahra's categories
  "Breakfast Box",
  "Client Gifts",
  "Fruits & Vegetables",
  "Groceries",
  "Shower Gel",
  "Shampoo",
  "Cleaning Supplies",
  "Gas",
  "Tableware",
  "Cookware",
  "Laundry Supplies",
  "Dry Cleaning",
  "Repairs",
  // Mouad's categories
  "Rent",
  "Plumbing",
  "Bobker",
  "Supplies",
  "Carpenter",
  "Internet",
  "Mason",
  "Omar",
  "AC",
  // Admin-only
  "Electricity",
  "Water",
  "Other",
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  
  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Utilities");
  const [formAmount, setFormAmount] = useState("");
  const [formReceiptUrl, setFormReceiptUrl] = useState("");
  const [formReceiptName, setFormReceiptName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    try {
      const res = await fetch("/api/expenses");
      const data = await res.json();
      setExpenses(data.expenses || []);
      setSummary(data.summary || null);
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
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formDate,
          description: formDescription,
          category: formCategory,
          amount_dh: parseFloat(formAmount),
          receipt_url: formReceiptUrl,
        }),
      });

      if (res.ok) {
        // Reset form
        setFormDescription("");
        setFormAmount("");
        setFormReceiptUrl("");
        setFormReceiptName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        // Refresh list
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

  async function handleDelete(expense_id: string) {
    if (!confirm("Delete this expense?")) return;

    try {
      const res = await fetch(`/api/expenses?id=${expense_id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchExpenses();
      } else {
        alert("Failed to delete");
      }
    } catch (error) {
      alert("Failed to delete");
    }
  }

  // Generate PDF report
  function generatePDF(isOperationsReport: boolean) {
    const doc = new jsPDF();
    
    // Filter expenses for operations report (exclude sensitive categories)
    const reportExpenses = isOperationsReport 
      ? expenses.filter(e => !SENSITIVE_CATEGORIES.includes(e.category))
      : expenses;
    
    // Apply current filters
    const finalExpenses = reportExpenses.filter(e => {
      if (filterMonth && !e.date.startsWith(filterMonth)) return false;
      if (filterCategory && e.category !== filterCategory) return false;
      return true;
    });

    // Sort by date descending
    finalExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate totals
    const total = finalExpenses.reduce((sum, e) => sum + e.amount_dh, 0);
    const byCategory: Record<string, number> = {};
    finalExpenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount_dh;
    });

    // Title
    const reportTitle = isOperationsReport ? "Operations Expense Report" : "Full Expense Report";
    const dateRange = filterMonth 
      ? new Date(filterMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "All Time";

    doc.setFontSize(20);
    doc.text("Riad di Siena", 14, 20);
    doc.setFontSize(14);
    doc.text(reportTitle, 14, 30);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${dateRange}`, 14, 38);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 44);

    // Summary box
    doc.setDrawColor(200);
    doc.setFillColor(250, 249, 247);
    doc.roundedRect(14, 52, 180, 30, 2, 2, "FD");
    
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text("Total Expenses", 20, 62);
    doc.setFontSize(18);
    doc.text(`${total.toLocaleString()} DH`, 20, 72);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${finalExpenses.length} expenses`, 100, 67);

    // Category breakdown
    let yPos = 95;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("By Category", 14, yPos);
    yPos += 8;

    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, amount]) => {
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text(category, 14, yPos);
        doc.text(`${amount.toLocaleString()} DH`, 80, yPos);
        yPos += 6;
      });

    // Expenses table
    yPos += 10;
    
    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Description", "Category", "Amount (DH)"]],
      body: finalExpenses.map(e => [
        new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        e.description,
        e.category,
        e.amount_dh.toLocaleString(),
      ]),
      theme: "plain",
      headStyles: {
        fillColor: [245, 245, 243],
        textColor: [60, 60, 60],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [40, 40, 40],
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 80 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30, halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    }

    // Save
    const filename = isOperationsReport 
      ? `riad-operations-expenses-${filterMonth || "all"}.pdf`
      : `riad-expenses-${filterMonth || "all"}.pdf`;
    doc.save(filename);
  }

  // Filter expenses
  const filteredExpenses = expenses.filter(e => {
    if (filterMonth && !e.date.startsWith(filterMonth)) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    return true;
  });

  // Get unique months for filter
  const months = Array.from(new Set(expenses.map(e => e.date.substring(0, 7)))).sort().reverse();

  // Calculate filtered total
  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount_dh, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="animate-pulse text-stone-500">Loading expenses...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-[11px] uppercase tracking-[0.1em] text-stone-400 hover:text-stone-600">
                ← Back to Admin
              </Link>
              <h1 className="text-[28px] font-serif text-stone-800 mt-1">Expenses</h1>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/petty-cash"
                className="px-3 py-1.5 text-[12px] text-stone-500 hover:text-stone-700 border border-stone-200 rounded hover:border-stone-300 transition-colors"
              >
                Petty Cash
              </Link>
              <a
                href={`${SHEET_URL}#gid=expenses`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-[12px] text-stone-500 hover:text-stone-700 border border-stone-200 rounded hover:border-stone-300 transition-colors"
              >
                View Sheet →
              </a>
              
              <div className="relative group">
                <button className="px-3 py-1.5 text-[12px] text-stone-600 bg-stone-100 hover:bg-stone-200 rounded transition-colors flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export PDF
                </button>
                
                {/* Dropdown */}
                <div className="absolute right-0 mt-1 w-48 bg-white border border-stone-200 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => generatePDF(false)}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-stone-700 hover:bg-stone-50 border-b border-stone-100"
                  >
                    <span className="font-medium">Full Report</span>
                    <span className="block text-[11px] text-stone-400 mt-0.5">All categories (for you)</span>
                  </button>
                  <button
                    onClick={() => generatePDF(true)}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-stone-700 hover:bg-stone-50"
                  >
                    <span className="font-medium">Operations Report</span>
                    <span className="block text-[11px] text-stone-400 mt-0.5">For Zahra & Mouad</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Total display */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
            <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500">{summary?.count} expenses</p>
            <p className="text-[24px] font-serif text-stone-700">
              {summary?.total.toLocaleString()} <span className="text-[14px] text-stone-400">DH</span>
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Add Expense Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[14px] font-medium text-stone-800 mb-4">Add Expense</h2>
              
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
                  <label className="block text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g., Electricity bill January"
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
                    {CATEGORIES.map(cat => (
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
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-stone-200 rounded text-[14px] focus:outline-none focus:border-stone-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1">Receipt (optional)</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full px-3 py-2 border border-dashed border-stone-300 rounded text-[13px] text-stone-500 hover:border-stone-400 hover:text-stone-600 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      "Uploading..."
                    ) : formReceiptName ? (
                      <span className="text-emerald-600">✓ {formReceiptName}</span>
                    ) : (
                      "Click to upload JPG, PNG, or PDF"
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={saving || !formDescription || !formAmount}
                  className="w-full py-2.5 bg-stone-800 text-white text-[13px] tracking-[0.02em] rounded hover:bg-stone-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add Expense"}
                </button>
              </form>
            </div>

            {/* Summary by Category */}
            {summary && (
              <div className="bg-white rounded-lg border border-stone-200 p-6 mt-6">
                <h2 className="text-[14px] font-medium text-stone-800 mb-4">By Category</h2>
                <div className="space-y-2">
                  {Object.entries(summary.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between text-[13px]">
                        <span className="text-stone-600">{category}</span>
                        <span className="text-stone-800 font-medium">{amount.toLocaleString()} DH</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Expenses List */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded text-[13px] bg-white focus:outline-none focus:border-stone-400"
              >
                <option value="">All Months</option>
                {months.map(month => (
                  <option key={month} value={month}>
                    {new Date(month + "-01").toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                  </option>
                ))}
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded text-[13px] bg-white focus:outline-none focus:border-stone-400"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {(filterMonth || filterCategory) && (
                <div className="flex items-center text-[13px] text-stone-600 ml-auto">
                  Showing: <span className="font-medium ml-1">{filteredTotal.toLocaleString()} DH</span>
                </div>
              )}
            </div>

            {/* Expenses Table */}
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-stone-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-stone-500 font-medium">Description</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-stone-500 font-medium">Category</th>
                    <th className="text-right px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-stone-500 font-medium">Amount</th>
                    <th className="text-center px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-stone-500 font-medium w-20">Receipt</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-400 text-[14px]">
                        No expenses found
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <tr key={expense.expense_id} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="px-4 py-3 text-[13px] text-stone-600">
                          {new Date(expense.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-stone-800">
                          {expense.description}
                          {expense.source && expense.source !== "admin" && (
                            <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              expense.source === "zahra" 
                                ? "bg-blue-50 text-blue-600" 
                                : "bg-purple-50 text-purple-600"
                            }`}>
                              {expense.source === "zahra" ? "Z" : "M"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 bg-stone-100 rounded text-[11px] text-stone-600">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-stone-800 text-right font-medium">
                          {expense.amount_dh.toLocaleString()} DH
                        </td>
                        <td className="px-4 py-3 text-center">
                          {expense.receipt_url ? (
                            <a
                              href={expense.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-600 hover:text-amber-700 text-[12px]"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-stone-300 text-[12px]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => handleDelete(expense.expense_id)}
                            className="text-stone-300 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Monthly Summary */}
            {summary && Object.keys(summary.byMonth).length > 0 && (
              <div className="bg-white rounded-lg border border-stone-200 p-6 mt-6">
                <h2 className="text-[14px] font-medium text-stone-800 mb-4">Monthly Totals</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Object.entries(summary.byMonth)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 12)
                    .map(([month, amount]) => (
                      <div key={month} className="text-center p-3 bg-stone-50 rounded">
                        <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500">
                          {new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        </p>
                        <p className="text-[16px] font-medium text-stone-800 mt-1">{amount.toLocaleString()} DH</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
