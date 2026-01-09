"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ReviewStats {
  totalReviews: number;
  overallAverage: number;
  distribution: Record<string, number>;
  issues: Array<{
    issue: string;
    count: number;
    examples: string[];
    category: string;
  }>;
  monthlyRatings: Array<{
    month: string;
    avgScore: number;
    count: number;
    categories: Record<string, number>;
  }>;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    keywords: Array<{ word: string; count: number; sentiment: "positive" | "negative" }>;
  };
  correlation: {
    coefficient: number;
    interpretation: string;
    data: Array<{ month: string; avgRating: number; occupancyNights: number }>;
  };
}

interface ChecklistItem {
  issue_id: string;
  issue_text: string;
  category: string;
  resolved: boolean;
  resolved_date: string;
}

interface ADRStats {
  monthly: Array<{
    month: string;
    adr: number;
    totalRevenue: number;
    totalNights: number;
    bookingCount: number;
  }>;
  yearly: Array<{
    year: string;
    adr: number;
    totalNights: number;
  }>;
  overall: {
    adr: number;
    totalRevenue: number;
    totalNights: number;
    bookingCount: number;
  };
  trend: {
    recent6MonthsADR: number;
    previous6MonthsADR: number;
    percentChange: number;
  };
}

export default function InsightsPage() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [adrStats, setAdrStats] = useState<ADRStats | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "issues" | "trends" | "correlation" | "adr">("overview");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/insights/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadMessage({ type: "success", text: data.message });
        // Refresh the data
        setLoading(true);
        await fetchData();
      } else {
        setUploadMessage({ type: "error", text: data.error || "Upload failed" });
      }
    } catch (error) {
      setUploadMessage({ type: "error", text: "Upload failed" });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [reviewsRes, checklistRes, adrRes] = await Promise.all([
        fetch("/api/insights/reviews"),
        fetch("/api/insights/checklist"),
        fetch("/api/insights/adr"),
      ]);
      
      const reviewsData = await reviewsRes.json();
      const checklistData = await checklistRes.json();
      const adrData = await adrRes.json();
      
      setStats(reviewsData);
      setChecklist(checklistData.items || []);
      setAdrStats(adrData);
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleIssue(issue: { issue: string; category: string }, resolved: boolean) {
    const issueId = issue.issue.toLowerCase().replace(/[^a-z0-9]/g, "-");
    setUpdating(issueId);
    
    try {
      await fetch("/api/insights/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_id: issueId,
          issue_text: issue.issue,
          category: issue.category,
          resolved,
        }),
      });
      
      // Update local state
      setChecklist(prev => {
        const existing = prev.find(item => item.issue_id === issueId);
        if (existing) {
          return prev.map(item =>
            item.issue_id === issueId
              ? { ...item, resolved, resolved_date: resolved ? new Date().toISOString().split("T")[0] : "" }
              : item
          );
        } else {
          return [...prev, {
            issue_id: issueId,
            issue_text: issue.issue,
            category: issue.category,
            resolved,
            resolved_date: resolved ? new Date().toISOString().split("T")[0] : "",
          }];
        }
      });
    } catch (error) {
      console.error("Error updating checklist:", error);
    } finally {
      setUpdating(null);
    }
  }

  function isResolved(issueText: string): boolean {
    const issueId = issueText.toLowerCase().replace(/[^a-z0-9]/g, "-");
    return checklist.find(item => item.issue_id === issueId)?.resolved || false;
  }

  function getResolvedDate(issueText: string): string {
    const issueId = issueText.toLowerCase().replace(/[^a-z0-9]/g, "-");
    return checklist.find(item => item.issue_id === issueId)?.resolved_date || "";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="animate-pulse text-stone-500">Loading insights...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="text-red-500">Failed to load review data</div>
      </div>
    );
  }

  // Get last 36 months for the chart
  const last36Months = stats.monthlyRatings.slice(-36);
  const maxNights = Math.max(...stats.correlation.data.map(d => d.occupancyNights), 1);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept=".csv"
        className="hidden"
      />

      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-[11px] uppercase tracking-[0.1em] text-stone-400 hover:text-stone-600">
                ← Back to Admin
              </Link>
              <h1 className="text-[28px] font-serif text-stone-800 mt-1">Review Insights</h1>
            </div>
            <div className="flex items-center gap-6">
              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 text-[12px] tracking-[0.02em] text-stone-600 hover:text-stone-800 border border-stone-300 hover:border-stone-400 rounded transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload CSV
                  </>
                )}
              </button>
              <div className="text-right">
                <p className="text-[32px] font-serif text-amber-600">{stats.overallAverage.toFixed(1)}</p>
                <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500">{stats.totalReviews} reviews</p>
              </div>
            </div>
          </div>
          {/* Upload message */}
          {uploadMessage && (
            <div className={`mt-3 text-[12px] ${uploadMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
              {uploadMessage.text}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-8">
            {[
              { id: "overview", label: "Overview" },
              { id: "issues", label: "Issues Checklist" },
              { id: "trends", label: "3-Year Trends" },
              { id: "correlation", label: "Rating vs Occupancy" },
              { id: "adr", label: "Average Daily Rate" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 text-[13px] tracking-[0.02em] border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Score Distribution */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">Score Distribution</h2>
              <div className="flex items-end gap-2 h-32">
                {Object.entries(stats.distribution).map(([score, count]) => {
                  const percentage = (count / stats.totalReviews) * 100;
                  const label = score === "below7" ? "<7" : score;
                  const color = score === "10" ? "bg-emerald-500" : score === "9" ? "bg-emerald-400" : score === "8" ? "bg-amber-400" : score === "7" ? "bg-amber-500" : "bg-red-400";
                  return (
                    <div key={score} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex flex-col items-center">
                        <span className="text-[11px] text-stone-500 mb-1">{percentage.toFixed(0)}%</span>
                        <div
                          className={`w-full ${color} rounded-t transition-all`}
                          style={{ height: `${Math.max(4, percentage * 1.2)}px` }}
                        />
                      </div>
                      <span className="text-[13px] font-medium text-stone-700 mt-2">{label}</span>
                      <span className="text-[11px] text-stone-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Sentiment Analysis */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">Sentiment Analysis</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <p className="text-[28px] font-serif text-emerald-600">{stats.sentiment.positive}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-emerald-700">Positive (9-10)</p>
                  <p className="text-[13px] text-emerald-600 mt-1">
                    {((stats.sentiment.positive / stats.totalReviews) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <p className="text-[28px] font-serif text-amber-600">{stats.sentiment.neutral}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-amber-700">Neutral (7-8)</p>
                  <p className="text-[13px] text-amber-600 mt-1">
                    {((stats.sentiment.neutral / stats.totalReviews) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-[28px] font-serif text-red-600">{stats.sentiment.negative}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-red-700">Negative (&lt;7)</p>
                  <p className="text-[13px] text-red-600 mt-1">
                    {((stats.sentiment.negative / stats.totalReviews) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              
              {/* Keywords */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.08em] text-stone-400 mb-3">Frequent Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {stats.sentiment.keywords.slice(0, 15).map(kw => (
                    <span
                      key={kw.word}
                      className={`px-3 py-1 rounded-full text-[12px] ${
                        kw.sentiment === "positive"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {kw.word} ({kw.count})
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Top Issues Preview */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500">Top Issues to Address</h2>
                <button
                  onClick={() => setActiveTab("issues")}
                  className="text-[12px] text-amber-600 hover:text-amber-700"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-3">
                {stats.issues.slice(0, 5).map((issue, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-medium ${
                      isResolved(issue.issue) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {isResolved(issue.issue) ? "✓" : issue.count}
                    </span>
                    <span className={`flex-1 text-[14px] ${isResolved(issue.issue) ? "text-stone-400 line-through" : "text-stone-700"}`}>
                      {issue.issue}
                    </span>
                    <span className="text-[11px] text-stone-400 uppercase tracking-[0.05em]">{issue.category}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Issues Checklist Tab */}
        {activeTab === "issues" && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-[13px] text-amber-800">
                <strong>Issues extracted from negative reviews.</strong> Check items when resolved. 
                The count shows how many reviews mentioned this issue.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100">
              {stats.issues.map((issue, idx) => {
                const resolved = isResolved(issue.issue);
                const resolvedDate = getResolvedDate(issue.issue);
                const issueId = issue.issue.toLowerCase().replace(/[^a-z0-9]/g, "-");
                
                return (
                  <div key={idx} className={`p-4 ${resolved ? "bg-emerald-50/50" : ""}`}>
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => toggleIssue(issue, !resolved)}
                        disabled={updating === issueId}
                        className={`mt-0.5 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          resolved
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-stone-300 hover:border-amber-500"
                        } ${updating === issueId ? "opacity-50" : ""}`}
                      >
                        {resolved && (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className={`text-[15px] font-medium ${resolved ? "text-stone-400 line-through" : "text-stone-800"}`}>
                            {issue.issue}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.05em] ${
                            resolved ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"
                          }`}>
                            {issue.category}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px]">
                            {issue.count} mentions
                          </span>
                        </div>
                        
                        {resolved && resolvedDate && (
                          <p className="text-[11px] text-emerald-600 mb-2">Resolved on {resolvedDate}</p>
                        )}
                        
                        {!resolved && issue.examples.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] uppercase tracking-[0.08em] text-stone-400 mb-1">Example feedback:</p>
                            {issue.examples.map((ex, i) => (
                              <p key={i} className="text-[12px] text-stone-500 italic pl-3 border-l-2 border-stone-200 mb-1">
                                "{ex}..."
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3-Year Trends Tab */}
        {activeTab === "trends" && (
          <div className="space-y-6">
            {/* Rating Trend Chart */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">Average Rating Over Time</h2>
              <div className="h-64 flex items-end gap-1">
                {last36Months.map((month, idx) => {
                  const height = ((month.avgScore - 7) / 3) * 100; // Scale 7-10 to 0-100%
                  const color = month.avgScore >= 9.5 ? "bg-emerald-500" : month.avgScore >= 9 ? "bg-emerald-400" : month.avgScore >= 8.5 ? "bg-amber-400" : "bg-amber-500";
                  const isCurrentMonth = idx === last36Months.length - 1;
                  
                  return (
                    <div key={month.month} className="flex-1 flex flex-col items-center group relative">
                      <div
                        className={`w-full ${color} ${isCurrentMonth ? "ring-2 ring-amber-500" : ""} rounded-t transition-all hover:opacity-80`}
                        style={{ height: `${Math.max(4, height)}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-stone-800 text-white text-[11px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {month.month}: {month.avgScore.toFixed(1)} ({month.count} reviews)
                      </div>
                      {/* Show year labels */}
                      {(idx === 0 || month.month.endsWith("-01")) && (
                        <span className="text-[9px] text-stone-400 mt-1 -rotate-45 origin-left">
                          {month.month.substring(0, 7)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-[11px] text-stone-400">
                <span>Scale: 7.0 - 10.0</span>
                <span>Hover for details</span>
              </div>
            </section>

            {/* Category Trends */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">Category Averages (Last 12 Months)</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {["staff", "cleanliness", "location", "facilities", "comfort", "value"].map(cat => {
                  const recent = last36Months.slice(-12);
                  const avg = recent.reduce((sum, m) => sum + (m.categories[cat] || 0), 0) / recent.filter(m => m.categories[cat] > 0).length;
                  const color = avg >= 9.5 ? "text-emerald-600" : avg >= 9 ? "text-emerald-500" : avg >= 8.5 ? "text-amber-500" : "text-amber-600";
                  
                  return (
                    <div key={cat} className="p-4 bg-stone-50 rounded-lg">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500 mb-1 capitalize">{cat}</p>
                      <p className={`text-[24px] font-serif ${color}`}>
                        {isNaN(avg) ? "-" : avg.toFixed(1)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Year-over-Year Comparison */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">Year-over-Year Comparison</h2>
              <div className="grid grid-cols-3 gap-6">
                {[2023, 2024, 2025].map(year => {
                  const yearMonths = stats.monthlyRatings.filter(m => m.month.startsWith(year.toString()));
                  const avg = yearMonths.length > 0
                    ? yearMonths.reduce((sum, m) => sum + m.avgScore, 0) / yearMonths.length
                    : 0;
                  const count = yearMonths.reduce((sum, m) => sum + m.count, 0);
                  
                  return (
                    <div key={year} className="text-center p-4 bg-stone-50 rounded-lg">
                      <p className="text-[13px] text-stone-500 mb-2">{year}</p>
                      <p className="text-[32px] font-serif text-stone-800">{avg > 0 ? avg.toFixed(1) : "-"}</p>
                      <p className="text-[11px] text-stone-400">{count} reviews</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* Correlation Tab */}
        {activeTab === "correlation" && (
          <div className="space-y-6">
            {/* Key Finding */}
            <div className={`p-6 rounded-lg border ${
              Math.abs(stats.correlation.coefficient) < 0.3
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              <h2 className="text-[15px] font-medium text-stone-800 mb-2">Key Finding</h2>
              <p className="text-[14px] text-stone-700 mb-3">
                The correlation between your review ratings and occupancy is{" "}
                <strong className={Math.abs(stats.correlation.coefficient) < 0.3 ? "text-emerald-700" : "text-amber-700"}>
                  {stats.correlation.interpretation}
                </strong>{" "}
                (r = {stats.correlation.coefficient.toFixed(3)}).
              </p>
              {Math.abs(stats.correlation.coefficient) < 0.3 && (
                <p className="text-[13px] text-emerald-700">
                  ✓ <strong>This proves that small rating fluctuations do NOT significantly impact your bookings.</strong>{" "}
                  Your occupancy is driven by other factors like seasonality, pricing, and location — not minor review variations.
                </p>
              )}
              {Math.abs(stats.correlation.coefficient) >= 0.3 && Math.abs(stats.correlation.coefficient) < 0.7 && (
                <p className="text-[13px] text-amber-700">
                  There is some relationship between ratings and occupancy, but other factors play a larger role.
                </p>
              )}
            </div>

            {/* Scatter Plot Visualization */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">
                Rating vs Occupancy (Monthly Data)
              </h2>
              <div className="relative h-80 border-l-2 border-b-2 border-stone-300 ml-8 mb-8">
                {/* Y-axis label */}
                <span className="absolute -left-8 top-1/2 -rotate-90 text-[10px] text-stone-400 whitespace-nowrap">
                  Nights Booked
                </span>
                {/* X-axis label */}
                <span className="absolute bottom-[-24px] left-1/2 text-[10px] text-stone-400">
                  Average Rating
                </span>
                
                {/* Plot points */}
                {stats.correlation.data.map((point, idx) => {
                  const x = ((point.avgRating - 7) / 3) * 100; // Scale 7-10 to 0-100%
                  const y = (point.occupancyNights / maxNights) * 100;
                  
                  return (
                    <div
                      key={idx}
                      className="absolute w-3 h-3 bg-amber-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 hover:bg-amber-600 hover:scale-150 transition-all group"
                      style={{
                        left: `${x}%`,
                        bottom: `${y}%`,
                      }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-stone-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {point.month}: {point.avgRating.toFixed(1)} rating, {point.occupancyNights} nights
                      </div>
                    </div>
                  );
                })}
                
                {/* Grid lines */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                  {[...Array(16)].map((_, i) => (
                    <div key={i} className="border-r border-t border-stone-100" />
                  ))}
                </div>
                
                {/* X-axis ticks */}
                <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[10px] text-stone-400">
                  <span>7.0</span>
                  <span>8.0</span>
                  <span>9.0</span>
                  <span>10.0</span>
                </div>
              </div>
            </section>

            {/* Data Table */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">Monthly Data</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left py-2 px-3 text-[11px] uppercase tracking-[0.05em] text-stone-500">Month</th>
                      <th className="text-right py-2 px-3 text-[11px] uppercase tracking-[0.05em] text-stone-500">Avg Rating</th>
                      <th className="text-right py-2 px-3 text-[11px] uppercase tracking-[0.05em] text-stone-500">Nights Booked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.correlation.data.slice(-12).map((row, idx) => (
                      <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="py-2 px-3 text-stone-700">{row.month}</td>
                        <td className="py-2 px-3 text-right text-stone-700">{row.avgRating.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-stone-700">{row.occupancyNights}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Statistical Explanation */}
            <section className="bg-stone-50 rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-3">Understanding the Correlation</h2>
              <div className="text-[13px] text-stone-600 space-y-2">
                <p>
                  <strong>Correlation coefficient (r):</strong> {stats.correlation.coefficient.toFixed(3)}
                </p>
                <p>
                  <strong>Interpretation:</strong>
                </p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li>r = 0: No relationship</li>
                  <li>|r| &lt; 0.3: Weak relationship</li>
                  <li>0.3 ≤ |r| &lt; 0.7: Moderate relationship</li>
                  <li>|r| ≥ 0.7: Strong relationship</li>
                </ul>
                <p className="mt-3 text-stone-500 italic">
                  A weak correlation suggests that other factors (seasonality, pricing, marketing, overall market conditions) 
                  drive your occupancy more than review ratings.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* ADR Tab */}
        {activeTab === "adr" && adrStats && (
          <div className="space-y-8">
            {/* ADR Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-stone-200 p-5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-1">Overall ADR</p>
                <p className="text-[28px] font-serif text-amber-600">€{adrStats.overall.adr.toFixed(0)}</p>
                <p className="text-[12px] text-stone-500 mt-1">per night</p>
              </div>
              <div className="bg-white rounded-lg border border-stone-200 p-5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-1">6-Month Trend</p>
                <p className={`text-[28px] font-serif ${adrStats.trend.percentChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {adrStats.trend.percentChange >= 0 ? "+" : ""}{adrStats.trend.percentChange.toFixed(1)}%
                </p>
                <p className="text-[12px] text-stone-500 mt-1">vs previous 6 months</p>
              </div>
              <div className="bg-white rounded-lg border border-stone-200 p-5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-1">Total Nights</p>
                <p className="text-[28px] font-serif text-stone-700">{adrStats.overall.totalNights.toLocaleString()}</p>
                <p className="text-[12px] text-stone-500 mt-1">booked</p>
              </div>
              <div className="bg-white rounded-lg border border-stone-200 p-5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-1">Total Revenue</p>
                <p className="text-[28px] font-serif text-stone-700">€{(adrStats.overall.totalRevenue / 1000).toFixed(0)}k</p>
                <p className="text-[12px] text-stone-500 mt-1">{adrStats.overall.bookingCount} bookings</p>
              </div>
            </div>

            {/* Monthly ADR Chart */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500">Monthly Average Daily Rate</h2>
                <div className="flex items-center gap-4 text-[11px] text-stone-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    ADR (€)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-emerald-500"></span>
                    Trend Line
                  </span>
                </div>
              </div>
              
              {/* Chart */}
              <div className="relative h-72">
                {(() => {
                  const data = adrStats.monthly.slice(-24); // Last 24 months
                  if (data.length === 0) return <p className="text-stone-500">No data available</p>;
                  
                  const maxADR = Math.max(...data.map(d => d.adr));
                  const minADR = Math.min(...data.map(d => d.adr));
                  const range = maxADR - minADR || 1;
                  const padding = range * 0.1;
                  const chartMin = Math.max(0, minADR - padding);
                  const chartMax = maxADR + padding;
                  const chartRange = chartMax - chartMin;
                  
                  // Calculate trend line (simple linear regression)
                  const n = data.length;
                  const sumX = data.reduce((sum, _, i) => sum + i, 0);
                  const sumY = data.reduce((sum, d) => sum + d.adr, 0);
                  const sumXY = data.reduce((sum, d, i) => sum + i * d.adr, 0);
                  const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);
                  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
                  const intercept = (sumY - slope * sumX) / n;
                  
                  const trendStart = intercept;
                  const trendEnd = intercept + slope * (n - 1);
                  
                  return (
                    <svg className="w-full h-full" viewBox={`0 0 ${data.length * 40 + 60} 280`} preserveAspectRatio="none">
                      {/* Y-axis labels */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                        const value = chartMax - pct * chartRange;
                        return (
                          <g key={i}>
                            <line x1="50" y1={20 + pct * 220} x2={data.length * 40 + 50} y2={20 + pct * 220} stroke="#e7e5e4" strokeWidth="1" />
                            <text x="45" y={24 + pct * 220} textAnchor="end" className="text-[10px] fill-stone-400">
                              €{value.toFixed(0)}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* Bars */}
                      {data.map((d, i) => {
                        const height = ((d.adr - chartMin) / chartRange) * 220;
                        const x = 55 + i * 40;
                        const y = 240 - height;
                        return (
                          <g key={i}>
                            <rect
                              x={x}
                              y={y}
                              width="30"
                              height={height}
                              fill="#f59e0b"
                              opacity={0.8}
                              rx="2"
                            />
                            {/* X-axis label (show every 3rd month) */}
                            {i % 3 === 0 && (
                              <text x={x + 15} y="260" textAnchor="middle" className="text-[9px] fill-stone-400">
                                {d.month.substring(2, 7)}
                              </text>
                            )}
                            {/* Hover tooltip area */}
                            <title>
                              {d.month}: €{d.adr.toFixed(0)}/night ({d.totalNights} nights, {d.bookingCount} bookings)
                            </title>
                          </g>
                        );
                      })}
                      
                      {/* Trend line */}
                      <line
                        x1="70"
                        y1={240 - ((trendStart - chartMin) / chartRange) * 220}
                        x2={55 + (data.length - 1) * 40 + 15}
                        y2={240 - ((trendEnd - chartMin) / chartRange) * 220}
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeDasharray="6,3"
                      />
                    </svg>
                  );
                })()}
              </div>
              
              {/* Trend indicator */}
              <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2">
                {adrStats.trend.percentChange >= 0 ? (
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                )}
                <span className="text-[13px] text-stone-600">
                  ADR is <strong>{adrStats.trend.percentChange >= 0 ? "increasing" : "decreasing"}</strong> — 
                  Recent 6 months: <strong>€{adrStats.trend.recent6MonthsADR.toFixed(0)}</strong> vs 
                  Previous 6 months: <strong>€{adrStats.trend.previous6MonthsADR.toFixed(0)}</strong>
                </span>
              </div>
            </section>

            {/* Yearly ADR Comparison */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">Year-over-Year ADR</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {adrStats.yearly.map((year, idx) => {
                  const prevYear = adrStats.yearly[idx - 1];
                  const change = prevYear ? ((year.adr - prevYear.adr) / prevYear.adr) * 100 : null;
                  return (
                    <div key={year.year} className="bg-stone-50 rounded-lg p-4">
                      <p className="text-[13px] font-medium text-stone-700">{year.year}</p>
                      <p className="text-[24px] font-serif text-amber-600 mt-1">€{year.adr.toFixed(0)}</p>
                      {change !== null && (
                        <p className={`text-[12px] mt-1 ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}% vs {adrStats.yearly[idx - 1].year}
                        </p>
                      )}
                      <p className="text-[11px] text-stone-500 mt-1">{year.totalNights} nights</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Monthly Data Table */}
            <section className="bg-white rounded-lg border border-stone-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-stone-500 mb-4">Monthly Detail (Last 12 Months)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2 px-3 text-left font-medium">Month</th>
                      <th className="py-2 px-3 text-right font-medium">ADR</th>
                      <th className="py-2 px-3 text-right font-medium">Revenue</th>
                      <th className="py-2 px-3 text-right font-medium">Nights</th>
                      <th className="py-2 px-3 text-right font-medium">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adrStats.monthly.slice(-12).reverse().map((row, idx) => (
                      <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="py-2 px-3 text-stone-700">{row.month}</td>
                        <td className="py-2 px-3 text-right font-medium text-amber-600">€{row.adr.toFixed(0)}</td>
                        <td className="py-2 px-3 text-right text-stone-700">€{row.totalRevenue.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-stone-700">{row.totalNights}</td>
                        <td className="py-2 px-3 text-right text-stone-700">{row.bookingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Tips Section */}
            <section className="bg-amber-50 rounded-lg border border-amber-200 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-amber-700 mb-3">Strategies to Increase ADR</h2>
              <ul className="text-[13px] text-amber-800 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span><strong>Seasonal pricing:</strong> Increase rates during peak seasons (March-May, Sept-Nov) and major events.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span><strong>Minimum stay requirements:</strong> Set 2-3 night minimums during high-demand periods.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span><strong>Value-adds over discounts:</strong> Include breakfast, airport transfers, or experiences instead of lowering price.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span><strong>Direct booking incentives:</strong> Offer exclusive perks for direct bookings to reduce OTA fees.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span><strong>Photography refresh:</strong> Update listing photos to justify premium pricing.</span>
                </li>
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
