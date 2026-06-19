'use client';

import { Smile, Meh, Frown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingWidgetProps {
  value: 'easy' | 'medium' | 'hard' | null;
  onChange: (value: 'easy' | 'medium' | 'hard') => void;
  disabled?: boolean;
  className?: string;
}

export default function RatingWidget({
  value,
  onChange,
  disabled = false,
  className,
}: RatingWidgetProps) {
  const options = [
    {
      id: 'easy' as const,
      label: 'Easy',
      labelVi: 'Dễ',
      icon: Smile,
      colorClass: {
        active: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20',
        inactive: 'bg-white border-emerald-100 text-emerald-700 hover:bg-emerald-50/50 hover:border-emerald-200',
      },
    },
    {
      id: 'medium' as const,
      label: 'Medium',
      labelVi: 'Vừa',
      icon: Meh,
      colorClass: {
        active: 'bg-amber-500 hover:bg-amber-400 text-white border-amber-500 shadow-md shadow-amber-500/20',
        inactive: 'bg-white border-amber-100 text-amber-700 hover:bg-amber-50/50 hover:border-amber-200',
      },
    },
    {
      id: 'hard' as const,
      label: 'Hard',
      labelVi: 'Khó',
      icon: Frown,
      colorClass: {
        active: 'bg-rose-600 hover:bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20',
        inactive: 'bg-white border-rose-100 text-rose-700 hover:bg-rose-50/50 hover:border-rose-200',
      },
    },
  ];

  return (
    <div className={cn("rounded-2xl border border-orange-100/60 bg-white p-4 px-4.5 shadow-sm", className)}>
      <div className="mb-3 text-center sm:text-left">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Feedback</h4>
        <h3 className="text-sm font-bold text-slate-800 mt-0.5">Rate this question to proceed</h3>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {options.map((opt) => {
          const isActive = value === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={cn(
                "flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2 px-3 border text-xs font-bold transition-all duration-200 cursor-pointer select-none",
                isActive ? opt.colorClass.active : opt.colorClass.inactive,
                disabled && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform duration-200" />
              <div className="text-center sm:text-left">
                <span className="block text-[11px] sm:text-xs leading-none">{opt.label}</span>
                <span className={cn("block text-[9px] font-normal leading-none mt-0.5", isActive ? "text-white/80" : "text-slate-400")}>{opt.labelVi}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
