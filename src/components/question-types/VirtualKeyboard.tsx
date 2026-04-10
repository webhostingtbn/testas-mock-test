'use client';

import { Delete } from 'lucide-react';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
}

export default function VirtualKeyboard({ onKeyPress }: VirtualKeyboardProps) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => onKeyPress(key)}
          className="
            h-14 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300
            text-xl font-bold text-gray-800
            transition-all duration-100 active:scale-95
            shadow-sm hover:shadow
            border border-gray-200
          "
        >
          {key}
        </button>
      ))}

      {/* Delete button spanning remaining cells */}
      <button
        onClick={() => onKeyPress('delete')}
        className="
          col-span-2 h-14 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200
          text-sm font-semibold text-red-600
          transition-all duration-100 active:scale-95
          shadow-sm hover:shadow
          border border-red-200
          flex items-center justify-center gap-2
        "
      >
        <Delete className="w-5 h-5" />
        Delete
      </button>
    </div>
  );
}
