"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

interface ImportResults {
  added: number;
  updated: number;
  unchanged: number;
  cancelled: number;
  errors: string[];
  changes: string[];
  source?: string;
  detectedHeaders?: string[];
}

interface AuthStatus {
  status: "checking" | "ok" | "error";
  error?: string;
  details?: string;
  help?: string[];
}

export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"booking" | "airbnb">("booking");
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ status: "checking" });

  // Test auth on load
  useEffect(() => {
    fetch("/api/test-auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ok") {
          setAuthStatus({ status: "ok" });
        } else {
          setAuthStatus({
            status: "error",
            error: data.error || "Unknown error",
            details: data.details || undefined,
            help: Array.isArray(data.help) ? data.help : undefined,
          });
        }
      })
      .catch(() => {
        setAuthStatus({ status: "error", error: "Could not check authentication" });
      });
  }, []);

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
    setError(null);
    setErrorDetails(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Upload failed");
        setErrorDetails(data.details || null);
        return;
      }

      setResults({
        ...data.results,
        source: data.source,
        detectedHeaders: data.detectedHeaders,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  // Safe array helpers
  const helpSteps = authStatus.help || [];
  const changesList = results?.changes || [];
  const errorsList = results?.errors || [];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="border-b border-black/[0.06] py-5 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-black/40 hover:text-black transition-colors text-[13px]"
            >
              ← Back
            </Link>
            <div>
              <h1 className="font-serif text-[22px] tracking-[-0.02em]">Import Bookings</h1>
              <p className="text-[11px] text-black/40">Booking.com & Airbnb imports</p>
            </div>
          </div>
          
          {/* Auth status indicator */}
          <div className="flex items-center gap-2">
            {authStatus.status === "checking" && (
              <span className="text-[11px] text-black/35">Checking connection...</span>
            )}
            {authStatus.status === "ok" && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Connected
              </span>
            )}
            {authStatus.status === "error" && (
              <span className="flex items-center gap-1.5 text-[11px] text-red-600">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Auth Error
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Auth Error Banner */}
        {authStatus.status === "error" && (
          <div className="mb-8 p-5 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p className="font-semibold text-[13px] mb-2">⚠️ Authentication Error: {authStatus.error}</p>
            {authStatus.details && (
              <p className="text-[13px] mb-4 text-red-700">{authStatus.details}</p>
            )}
            {helpSteps.length > 0 && (
              <div className="text-[13px] space-y-1">
                <p className="font-semibold">How to fix:</p>
                <ol className="list-decimal list-inside space-y-1 text-red-700">
                  {helpSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-black/[0.06] mb-8">
          <button
            onClick={() => setActiveTab("booking")}
            className={`px-5 py-3 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === "booking"
                ? "border-black text-black"
                : "border-transparent text-black/40 hover:text-black/70"
            }`}
          >
            Booking.com
          </button>
          <button
            onClick={() => setActiveTab("airbnb")}
            className={`px-5 py-3 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === "airbnb"
                ? "border-black text-black"
                : "border-transparent text-black/40 hover:text-black/70"
            }`}
          >
            Airbnb
          </button>
        </div>

        {/* Instructions - Booking.com */}
        {activeTab === "booking" && (
          <div className="mb-8 p-5 bg-white border border-black/[0.06] rounded-lg">
            <p className="text-[11px] uppercase tracking-[0.12em] text-black/35 mb-4">How to Export from Booking.com</p>
            <ol className="space-y-2 text-[13px] text-black/70">
              <li>1. Go to Booking.com Extranet → Reservations</li>
              <li>2. Set date range: Today → 6 months out</li>
              <li>3. Click Export → Select &quot;Check-in with contact details&quot;</li>
              <li>4. Download the CSV file</li>
              <li>5. Drop it below</li>
            </ol>
          </div>
        )}

        {/* Instructions - Airbnb */}
        {activeTab === "airbnb" && (
          <div className="mb-8 p-5 bg-white border border-black/[0.06] rounded-lg">
            <p className="text-[11px] uppercase tracking-[0.12em] text-black/35 mb-4">How to Export from Airbnb</p>
            <ol className="space-y-2 text-[13px] text-black/70">
              <li>1. Go to Airbnb Host → Reservations</li>
              <li>2. Click the &quot;Export&quot; button (top right)</li>
              <li>3. Select date range (e.g., next 6 months)</li>
              <li>4. Download the CSV file</li>
              <li>5. Drop it below</li>
            </ol>
            <p className="mt-4 text-[11px] text-black/40">
              The system will automatically detect Airbnb format and map columns correctly.
            </p>
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer
            ${isDragging 
              ? "border-black bg-black/[0.02]" 
              : "border-black/15 hover:border-black/30"
            }
            ${authStatus.status === "error" ? "opacity-50 pointer-events-none" : ""}
          `}
          onClick={() => authStatus.status === "ok" && document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            disabled={authStatus.status === "error"}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-black/15 border-t-black rounded-full animate-spin" />
              <p className="text-black/50 text-[13px]">Processing...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-black/15 flex items-center justify-center">
                <svg className="w-6 h-6 text-black/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-[15px] text-black/70 mb-2">
                Drop {activeTab === "booking" ? "Booking.com" : "Airbnb"} export here
              </p>
              <p className="text-[13px] text-black/40">or click to select file</p>
              <p className="text-[11px] text-black/30 mt-4">Supports CSV and Excel files • Auto-detects source</p>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p className="font-semibold text-[13px]">Error</p>
            <p className="text-[13px]">{error}</p>
            {errorDetails && (
              <p className="text-[13px] mt-2 text-red-600">{errorDetails}</p>
            )}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="mt-8 space-y-6">
            {/* Success Banner */}
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[13px] text-emerald-900">Upload successful</p>
                  <p className="text-[13px] text-emerald-700">
                    {results.added + results.updated + results.unchanged + results.cancelled} entries processed
                    {results.added > 0 && ` · ${results.added} new`}
                    {results.updated > 0 && ` · ${results.updated} updated`}
                    {results.cancelled > 0 && ` · ${results.cancelled} cancelled`}
                  </p>
                </div>
              </div>
            </div>

            {/* Source indicator */}
            {results.source && (
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-black/40">Detected source:</span>
                <span className="px-2 py-1 bg-black/[0.03] border border-black/[0.06] rounded font-medium text-[12px]">
                  {results.source === "airbnb" ? "Airbnb" : "Booking.com"}
                </span>
              </div>
            )}

            {/* Debug: Show detected headers */}
            {results.detectedHeaders && results.detectedHeaders.length > 0 && (
              <details className="text-[11px] text-black/40">
                <summary className="cursor-pointer hover:text-black/60">
                  Detected columns ({results.detectedHeaders.length})
                </summary>
                <div className="mt-2 p-3 bg-black/[0.02] border border-black/[0.06] rounded font-mono text-[10px]">
                  {results.detectedHeaders.join(", ")}
                </div>
              </details>
            )}

            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-4 bg-white border border-black/[0.06] rounded-lg text-center">
                <p className="text-[28px] font-serif text-emerald-600 tracking-[-0.02em]">{results.added}</p>
                <p className="text-[11px] text-black/40 uppercase tracking-[0.08em]">Added</p>
              </div>
              <div className="p-4 bg-white border border-black/[0.06] rounded-lg text-center">
                <p className="text-[28px] font-serif text-blue-600 tracking-[-0.02em]">{results.updated}</p>
                <p className="text-[11px] text-black/40 uppercase tracking-[0.08em]">Updated</p>
              </div>
              <div className="p-4 bg-white border border-black/[0.06] rounded-lg text-center">
                <p className="text-[28px] font-serif text-black/30 tracking-[-0.02em]">{results.unchanged}</p>
                <p className="text-[11px] text-black/40 uppercase tracking-[0.08em]">Unchanged</p>
              </div>
              <div className="p-4 bg-white border border-black/[0.06] rounded-lg text-center">
                <p className="text-[28px] font-serif text-amber-600 tracking-[-0.02em]">{results.cancelled}</p>
                <p className="text-[11px] text-black/40 uppercase tracking-[0.08em]">Cancelled</p>
              </div>
            </div>

            {/* Changes log */}
            {changesList.length > 0 && (
              <div className="bg-white border border-black/[0.06] rounded-lg overflow-hidden">
                <div className="p-4 border-b border-black/[0.06]">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">Change Log</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {changesList.map((change, i) => (
                    <div key={i} className="px-4 py-2.5 border-b border-black/[0.03] text-[13px] text-black/70">
                      {change}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {errorsList.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-red-200">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-red-600">Errors</p>
                </div>
                <div className="p-4 space-y-1">
                  {errorsList.map((err, i) => (
                    <p key={i} className="text-[13px] text-red-700">{err}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Next steps */}
            <div className="flex justify-between items-center pt-4 border-t border-black/[0.06]">
              <button
                onClick={() => {
                  setResults(null);
                  setError(null);
                  setErrorDetails(null);
                }}
                className="text-[13px] text-black/40 hover:text-black transition-colors"
              >
                Import another file
              </button>
              <Link
                href="/guests"
                className="px-5 py-2.5 bg-black text-white text-[12px] font-semibold rounded-lg hover:bg-black/90 transition-colors"
              >
                View Guest Dashboard →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
