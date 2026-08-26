'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Slot {
  startTime: string;
  endTime: string;
  available: boolean;
}

interface BookingWizardProps {
  providerId: string;
  metadataContext?: Record<string, unknown>;
}

const COMMON_TIMEZONES = [
  { label: 'System Default', value: '' },
  { label: 'America/New_York (Eastern)', value: 'America/New_York' },
  { label: 'America/Chicago (Central)', value: 'America/Chicago' },
  { label: 'America/Denver (Mountain)', value: 'America/Denver' },
  { label: 'America/Los_Angeles (Pacific)', value: 'America/Los_Angeles' },
  { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
  { label: 'Europe/Paris (CET/CEST)', value: 'Europe/Paris' },
  { label: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'UTC', value: 'UTC' },
];

export default function BookingWizard({ providerId, metadataContext = {} }: BookingWizardProps) {
  // ISO date string YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedTimezone, setSelectedTimezone] = useState<string>('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Form inputs
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Detect user's local browser timezone on mount
  useEffect(() => {
    try {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setSelectedTimezone(localTz || 'America/Chicago');
    } catch {
      setSelectedTimezone('UTC');
    }
  }, []);

  // Fetch available slots dynamically when selectedDate changes
  const fetchSlots = useCallback(async () => {
    setIsLoadingSlots(true);
    setErrorMsg(null);
    setSelectedSlot(null);

    try {
      const response = await fetch(
        `/api/availability?providerId=${encodeURIComponent(providerId)}&date=${selectedDate}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load availability');
      }

      setSlots(data.slots || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An unexpected error occurred while loading slots.');
      }
    } finally {
      setIsLoadingSlots(false);
    }
  }, [providerId, selectedDate]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          startTime: selectedSlot.startTime,
          durationMinutes: 60,
          customerName,
          customerEmail,
          metadata: {
            ...metadataContext,
            user_timezone: selectedTimezone,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete booking');
      }

      setIsSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An unexpected error occurred.');
      }
      fetchSlots();
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Helper to format an ISO date string in the target timezone
   */
  const formatTime = (isoString: string, targetTz?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: targetTz || selectedTimezone || undefined,
        timeZoneName: 'short',
      }).format(date);
    } catch {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto p-8 bg-emerald-50 border border-emerald-200 rounded-2xl text-center shadow-lg font-sans">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
          ✓
        </div>
        <h3 className="text-2xl font-bold text-emerald-950">Booking Confirmed</h3>
        <p className="text-sm text-emerald-800 mt-2">
          Your reservation is set for{' '}
          <span className="font-semibold">
            {new Date(selectedSlot?.startTime || '').toLocaleDateString('en-US', {
              timeZone: selectedTimezone || undefined,
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}{' '}
            at {formatTime(selectedSlot?.startTime || '')}
          </span>
          .
        </p>
        <p className="text-xs text-emerald-700 mt-1">
          Confirmation sent to <span className="font-medium">{customerEmail}</span>
        </p>
        <button
          onClick={() => {
            setIsSuccess(false);
            setCustomerName('');
            setCustomerEmail('');
            fetchSlots();
          }}
          className="mt-6 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
        >
          Book Another Appointment
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-6 font-sans">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Schedule a Session</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Select a date and timezone, pick an open slot, and confirm your details.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3.5 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl leading-relaxed">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleBooking} className="space-y-6">
        {/* Date & Timezone Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              1. Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 text-sm font-medium shadow-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Timezone
            </label>
            <select
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 text-sm font-medium shadow-sm bg-white"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Slots */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Available Slots
            </label>
            <span className="text-xs text-slate-400 font-medium truncate max-w-[180px]">
              {selectedTimezone}
            </span>
          </div>

          {isLoadingSlots ? (
            <div className="py-8 text-center text-sm text-slate-400 animate-pulse">
              Loading available slots...
            </div>
          ) : slots.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No slots available for this date.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.startTime === slot.startTime;
                return (
                  <button
                    key={slot.startTime}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all text-center ${
                      !slot.available
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                        : isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    {formatTime(slot.startTime)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer Input Fields */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            3. Your Information
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Alex Morgan"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
            />
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={!selectedSlot || isSubmitting}
          className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-md active:scale-[0.99]"
        >
          {isSubmitting ? 'Locking Appointment...' : 'Confirm Reservation'}
        </button>
      </form>
    </div>
  );
}