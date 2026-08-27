'use client';

import React from 'react';
import { SeatData } from '@/types/auditorium';
import { X, Check, Armchair } from 'lucide-react';

interface SeatPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  seats: SeatData[];
  currentSeatId: string;
  onSelectSeat: (seatId: string) => void;
}

export const SeatPickerModal: React.FC<SeatPickerModalProps> = ({
  isOpen,
  onClose,
  seats,
  currentSeatId,
  onSelectSeat,
}) => {
  if (!isOpen) return null;

  // Group seats by row
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-950/90 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold tracking-wide flex items-center gap-2">
              <Armchair className="w-5 h-5 text-sky-400" />
              Auditorium Seating Chart
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any seat to smoothly transition your vantage point.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stage Indicator */}
        <div className="py-4 flex flex-col items-center">
          <div className="w-3/4 max-w-lg h-3.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent rounded-full shadow-[0_0_20px_rgba(56,189,248,0.7)]" />
          <span className="text-[11px] font-bold text-sky-300 uppercase tracking-widest mt-1.5">
            MAIN STAGE & PRESENTATION SCREEN
          </span>
        </div>

        {/* Seating Grid */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-3.5">
          {rows.map((rowName) => {
            const rowSeats = seats.filter((s) => s.row === rowName);
            const tier = rowSeats[0]?.tier || 'Standard';

            return (
              <div key={rowName} className="flex items-center gap-3">
                {/* Row label badge */}
                <div className="w-16 flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold flex items-center justify-center text-slate-300">
                    {rowName}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">{tier}</span>
                </div>

                {/* Seats row */}
                <div className="flex-1 flex items-center justify-center gap-1 flex-wrap">
                  {rowSeats.map((seat, index) => {
                    const isCurrent = seat.id === currentSeatId;
                    const isOccupied = seat.status === 'occupied';
                    const half = Math.floor(rowSeats.length / 2);
                    const isAisleGap = index === half;

                    let btnClass = 'bg-slate-800/80 border-slate-700/70 text-slate-300 hover:bg-sky-900/80 hover:border-sky-500 hover:text-white';
                    if (seat.tier === 'VIP') {
                      btnClass = 'bg-amber-950/70 border-amber-700/60 text-amber-200 hover:bg-amber-800 hover:border-amber-500';
                    }
                    if (isOccupied) {
                      btnClass = 'bg-slate-900/40 border-slate-800/40 text-slate-600 cursor-not-allowed opacity-40';
                    }
                    if (isCurrent) {
                      btnClass = 'bg-sky-500 border-sky-300 text-white shadow-[0_0_14px_rgba(56,189,248,0.9)] scale-110 font-bold';
                    }

                    return (
                      <React.Fragment key={seat.id}>
                        {isAisleGap && <div className="w-5" />}
                        <button
                          disabled={isOccupied}
                          onClick={() => {
                            onSelectSeat(seat.id);
                            onClose();
                          }}
                          title={`Row ${seat.row}, Seat ${seat.number} (${seat.tier}) - $${seat.price}`}
                          className={`w-6 h-6 rounded-t-sm text-[10px] font-medium border flex items-center justify-center transition-all ${btnClass}`}
                        >
                          {isCurrent ? <Check className="w-3 h-3" /> : seat.number}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend & Footer */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-sky-500 border border-sky-300" />
              <span>Current Seat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-amber-900/80 border border-amber-600" />
              <span>VIP Tier</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-slate-800 border border-slate-700" />
              <span>Standard / Premium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-slate-900 border border-slate-800 opacity-50" />
              <span>Occupied</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            💡 Tip: You can also click directly on chairs in the 3D scene!
          </div>
        </div>
      </div>
    </div>
  );
};
