'use client';

interface LatinSquareProps {
  question: {
    id: string;
    content: {
      grid_image?: string;
      grid_image_url?: string;
      options?: string[];
    };
  };
  selectedAnswer: string | null;
  onAnswer: (letter: string) => void;
}

export default function LatinSquare({
  question,
  selectedAnswer,
  onAnswer,
}: LatinSquareProps) {
  const content = question.content ?? {};
  const imageUrl = content.grid_image_url || content.grid_image || '';
  const options = content.options && content.options.length > 0 
    ? content.options 
    : ['A', 'B', 'C', 'D', 'E']; // Standard fallback options

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading question...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Question label */}
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        Find the missing letter
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* Left: The grid image */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center justify-center w-full max-w-2xl">
          <img
            src={imageUrl}
            alt="Latin square puzzle"
            className="max-w-full max-h-[400px] object-contain block ring-1 ring-gray-100 rounded-lg"
          />
        </div>

        {/* Right: Answer options */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm w-full lg:w-auto">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Select Answer
          </h3>
          <div className="grid grid-cols-5 lg:grid-cols-2 gap-3 place-items-center">
            {options.map((letter) => {
              const isSelected = selectedAnswer === letter;

              return (
                <button
                  key={letter}
                  onClick={() => onAnswer(letter)}
                  className={`
                    w-12 h-12 md:w-16 md:h-16 rounded-xl text-xl md:text-2xl font-bold flex items-center justify-center
                    transition-all duration-200
                    ${
                      isSelected
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-105 ring-4 ring-orange-200'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }
                  `}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
