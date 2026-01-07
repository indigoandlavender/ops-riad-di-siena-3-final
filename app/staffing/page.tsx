"use client";

import { useState, useEffect } from "react";

interface DayInfo {
  date: string;
  dayName: string;
  dayNumber: number;
  isWeekend: boolean;
  checkIns: number;
  checkOuts: number;
  rooms: number;
  guests: string[];
  status: 'day-off' | 'normal' | 'busy' | 'extra-help';
}

interface WeekInfo {
  weekStart: string;
  weekEnd: string;
  days: DayInfo[];
  weekendClear: boolean;
  saturdayClear: boolean;
  sundayClear: boolean;
}

export default function StaffingPage() {
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);

  useEffect(() => {
    fetch("/api/staffing?weeks=6")
      .then((res) => res.json())
      .then((data) => {
        setWeeks(data.weeks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatWeekRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endStr = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${startStr} – ${endStr}`;
  };

  const getStatusColor = (status: DayInfo['status'], isWeekend: boolean) => {
    if (status === 'day-off') return isWeekend ? 'bg-emerald-50 border-emerald-300' : 'bg-black/[0.02] border-black/[0.06]';
    if (status === 'extra-help') return 'bg-red-50 border-red-300';
    if (status === 'busy') return 'bg-amber-50 border-amber-300';
    return 'bg-white border-black/[0.06]';
  };

  const getStatusBadge = (status: DayInfo['status']) => {
    if (status === 'day-off') return null;
    if (status === 'extra-help') return (
      <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold tracking-wide">
        +1 CLEANER
      </span>
    );
    if (status === 'busy') return (
      <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-semibold tracking-wide">
        BUSY
      </span>
    );
    return null;
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-[13px] text-black/40">Loading staffing data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-black/[0.06] px-4 py-5">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-serif text-[22px] text-black/90">Staffing Planner</h1>
          <p className="text-[11px] uppercase tracking-[0.08em] text-black/40 mt-1">
            Plan Zahra & Siham's days off • Green weekends = day off possible
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border-b border-black/[0.06] px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-5 text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-50 border border-emerald-300 rounded"></div>
            <span className="text-black/50">Weekend day off OK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border border-black/[0.06] rounded"></div>
            <span className="text-black/50">Normal (1-2 check-ins)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-50 border border-amber-300 rounded"></div>
            <span className="text-black/50">Busy (3-4 check-ins)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-300 rounded"></div>
            <span className="text-black/50">Need 2nd cleaner (5+ check-ins)</span>
          </div>
        </div>
      </div>

      {/* Weeks Grid */}
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {weeks.map((week, weekIdx) => (
          <div key={week.weekStart} className="bg-white rounded-lg border border-black/[0.06] overflow-hidden">
            {/* Week Header */}
            <div className="px-4 py-3 bg-black/[0.02] border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <span className="font-medium text-[13px] text-black/90">
                  {formatWeekRange(week.weekStart, week.weekEnd)}
                </span>
                {weekIdx === 0 && (
                  <span className="ml-2 text-[10px] bg-black text-white px-2 py-0.5 rounded-full font-semibold tracking-wide">
                    THIS WEEK
                  </span>
                )}
              </div>
              {week.weekendClear && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold tracking-wide">
                  ✓ WEEKEND DAY OFF
                  {week.saturdayClear && week.sundayClear ? ' (SAT & SUN)' : 
                   week.saturdayClear ? ' (SAT)' : ' (SUN)'}
                </span>
              )}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7">
              {week.days.map((day) => (
                <div
                  key={day.date}
                  onClick={() => day.checkIns > 0 && setSelectedDay(day)}
                  className={`
                    p-3 border-r border-black/[0.06] last:border-r-0
                    ${getStatusColor(day.status, day.isWeekend)}
                    ${day.isWeekend ? 'bg-opacity-50' : ''}
                    ${isToday(day.date) ? 'ring-2 ring-black ring-inset' : ''}
                    ${day.checkIns > 0 ? 'cursor-pointer hover:bg-opacity-75' : ''}
                    transition-colors
                  `}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] uppercase tracking-wider font-medium ${day.isWeekend ? 'text-black/50' : 'text-black/35'}`}>
                      {day.dayName.slice(0, 3)}
                    </span>
                    <span className={`font-serif text-lg ${isToday(day.date) ? 'text-black' : 'text-black/70'}`}>
                      {day.dayNumber}
                    </span>
                  </div>

                  {/* Check-ins Count */}
                  <div className="text-center">
                    {day.checkIns === 0 ? (
                      <div className={`text-2xl ${day.isWeekend ? 'text-emerald-500' : 'text-black/20'}`}>
                        {day.isWeekend ? '✓' : '—'}
                      </div>
                    ) : (
                      <div className="font-serif text-[28px] text-black/90">
                        {day.checkIns}
                      </div>
                    )}
                    {day.checkIns > 0 && (
                      <div className="text-[10px] text-black/40 mt-0.5 uppercase tracking-wide">
                        check-in{day.checkIns !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="mt-2 flex justify-center min-h-[20px]">
                    {getStatusBadge(day.status)}
                  </div>

                  {/* Check-outs indicator */}
                  {day.checkOuts > 0 && (
                    <div className="mt-1 text-[10px] text-black/35 text-center">
                      {day.checkOuts} out
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Guest List Modal */}
      {selectedDay && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDay(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg text-black/90">
                {new Date(selectedDay.date).toLocaleDateString('en-GB', { 
                  weekday: 'long',
                  day: 'numeric', 
                  month: 'long' 
                })}
              </h2>
              <button 
                onClick={() => setSelectedDay(null)}
                className="text-black/30 hover:text-black/60 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="w-20 text-[11px] uppercase tracking-[0.08em] text-black/40">Check-ins</span>
                <span className="font-medium text-black/90">{selectedDay.checkIns}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="w-20 text-[11px] uppercase tracking-[0.08em] text-black/40">Check-outs</span>
                <span className="font-medium text-black/90">{selectedDay.checkOuts}</span>
              </div>
              
              {selectedDay.guests.length > 0 && (
                <div className="mt-4 pt-4 border-t border-black/[0.06]">
                  <h3 className="text-[11px] uppercase tracking-[0.08em] text-black/40 mb-3">Arriving guests</h3>
                  <ul className="space-y-1.5">
                    {selectedDay.guests.map((guest, i) => (
                      <li key={i} className="text-[13px] text-black/70 pl-3 border-l-2 border-black/10">
                        {guest}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 text-[11px] text-black/30 tracking-wide">
        Data from Master_Guests • Tap a day to see guest names
      </div>
    </div>
  );
}
