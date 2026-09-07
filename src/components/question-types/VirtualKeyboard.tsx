'use client';

import { Delete } from 'lucide-react';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
}

export default function VirtualKeyboard({ onKeyPress }: VirtualKeyboardProps) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];

  return (
    <div className="grid grid-cols-3 gap-[10px]">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKeyPress(key)}
          className="
            h-12 rounded-[10px] border border-[#E5E7EB] bg-white
            hover:border-[#D1D5DB] hover:bg-[#FAFAFA] active:bg-[#F4F4F5]
            text-lg font-semibold text-[#18181B]
            transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40
          "
        >
          {key}
        </button>
      ))}

      {/* Delete button spanning remaining cells */}
      <button
        type="button"
        onClick={() => onKeyPress('delete')}
        aria-label="Delete last digit"
        className="
          col-span-2 h-12 rounded-[10px] border border-[#E5E7EB] bg-white
          hover:border-[#D1D5DB] hover:bg-[#FAFAFA] active:bg-[#F4F4F5]
          text-sm font-medium text-[#71717A] hover:text-[#18181B]
          transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40
          flex items-center justify-center gap-2
        "
      >
        <Delete className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
}
