import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CalendarPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
}

const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay(); // 0=Sun
  return (day + 6) % 7; // Monday=0
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
}) => {
  const today = new Date();

  const parseValue = () => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  const selected = parseValue();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownH = 280; // estimated height
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const openAbove = spaceBelow < dropdownH && spaceAbove > spaceBelow;

    // On mobile: center horizontally
    const isMobile = window.innerWidth < 500;
    let left = rect.left;
    let width = 260;

    if (isMobile) {
      width = Math.min(window.innerWidth - 24, 280);
      left = Math.max(12, (window.innerWidth - width) / 2);
    } else {
      // Clamp so it doesn't overflow right edge
      if (left + width > window.innerWidth - 8) {
        left = window.innerWidth - width - 8;
      }
    }

    setDropdownStyle({
      position: 'fixed',
      left,
      width,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (open) computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    const resizeHandler = () => { if (open) computePosition(); };

    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', resizeHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', resizeHandler);
    };
  }, [open, computePosition]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(v => v - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(v => v + 1);
  };

  const selectDay = (day: number) => {
    const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(d);
    setOpen(false);
  };

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const displayValue = selected
    ? selected.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const offset = getFirstDayOffset(viewYear, viewMonth);

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const selectedKey = selected
    ? `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`
    : null;

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-[#0F172A] border border-[#2563EB]/30 rounded-lg shadow-2xl shadow-black/90 p-3.5"
    >
      {/* Month Nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1E293B] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1E293B] transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 mb-1.5">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-slate-500 uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const key = `${viewYear}-${viewMonth}-${day}`;
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;

          return (
            <button
              key={day}
              type="button"
              onClick={() => selectDay(day)}
              className={`
                relative h-8 w-full text-xs font-medium rounded-md transition-all
                ${isSelected
                  ? 'bg-[#2563EB] text-white font-bold shadow-sm shadow-blue-500/30'
                  : isToday
                    ? 'text-[#60A5FA] font-bold hover:bg-[#1E293B]'
                    : 'text-slate-300 hover:bg-[#1E293B] hover:text-slate-100'
                }
              `}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#3B82F6]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#1E293B] flex justify-between items-center">
        <button
          type="button"
          onClick={() => {
            const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            onChange(d);
            setOpen(false);
          }}
          className="text-[10px] font-bold text-[#3B82F6] hover:text-[#60A5FA] transition-colors uppercase tracking-wide"
        >
          Aujourd'hui
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#090D16] border transition-colors cursor-pointer text-xs focus:outline-none ${
          open ? 'border-[#2563EB]/60' : 'border-[#1E293B] hover:border-[#2563EB]/60'
        }`}
      >
        <Calendar className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
        <span className={`flex-1 text-left truncate ${displayValue ? 'text-slate-200 font-semibold' : 'text-slate-500'}`}>
          {displayValue || placeholder}
        </span>
        {selected && (
          <span
            onClick={clearDate}
            className="text-slate-500 hover:text-slate-200 transition-colors p-0.5 rounded"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Render dropdown via portal to escape overflow:hidden parents */}
      {createPortal(dropdown, document.body)}
    </div>
  );
};
