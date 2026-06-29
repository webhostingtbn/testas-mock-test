'use client';

interface NumericalSeriesProps {
  question: {
    id: string;
    content: {
      sequence: (number | string)[];
      target_index?: number;
      prompt?: string;
    };
  };
  selectedAnswer: string | null;
  onAnswer: (val: string) => void;
}

export default function NumericalSeries({
  question,
  selectedAnswer,
  onAnswer,
}: NumericalSeriesProps) {
  const sequence = question?.content?.sequence || [];
  // Find index of '?' or fallback to target_index, otherwise fallback to last element
  const fallbackIndex = sequence.indexOf('?') !== -1 ? sequence.indexOf('?') : sequence.length - 1;
  const targetIndex = question?.content?.target_index ?? fallbackIndex;
  const prompt = question?.content?.prompt || 'Find the missing number in the numerical series.';
  
  const currentChars = selectedAnswer ? selectedAnswer.split('') : [];
  const keys = ['-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const toggleChar = (char: string) => {
    let nextChars: string[];
    if (currentChars.includes(char)) {
      nextChars = currentChars.filter(c => c !== char);
    } else {
      nextChars = [...currentChars, char];
    }
    // Store as joined string
    onAnswer(nextChars.join(''));
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      {/* Prompt / Title */}
      <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex-none">
        {prompt}
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 gap-6 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar pb-12 lg:pb-0">
        {/* Sequence Display Card */}
        <div className="bg-white rounded-2xl border border-orange-100 p-4 shadow-sm flex flex-col items-center justify-center min-h-28">
          <div className="flex flex-wrap gap-3 items-start justify-center py-6 px-4 w-full">
            {sequence.map((item, idx) => {
              const isTarget = idx === targetIndex;
              if (isTarget) {
                const displayVal = currentChars.length > 0 ? currentChars.sort().join(', ') : '?';
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="min-w-24 px-4 h-14 flex items-center justify-center text-xl font-bold font-mono border-2 border-orange-500 bg-orange-50/50 rounded-xl shadow-inner text-orange-850">
                      {displayVal}
                    </div>
                    <span className="text-[9px] font-bold text-orange-600 uppercase tracking-wider">Your Marks</span>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="w-16 h-14 flex items-center justify-center text-lg font-bold font-mono bg-slate-50 border border-slate-200 rounded-xl shadow-sm text-slate-800"
                >
                  {item}
                </div>
              );
            })}
          </div>
        </div>

        {/* Paper Answer Sheet Card */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="mb-1">
            {/* <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span>📝 TestAS Answer Sheet (Continuing Numerical Series)</span>
            </h4> */}
            <p className="text-xs text-slate-500 leading-relaxed">
              Mark the digits that appear in your solution. If the number is negative, mark the <strong>"-"</strong> box. The order of the digits does not matter.
            </p>
          </div>

          <div className="overflow-x-auto w-full py-1">
            <div className="min-w-[480px] md:min-w-full border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm">
              {/* Header Row */}
              <div className="flex border-b border-slate-300 bg-slate-55 font-bold font-mono text-center text-sm text-slate-700">
                <div className="w-12 border-r border-slate-300 bg-slate-100/50 flex items-center justify-center" />
                {keys.map((key) => (
                  <div key={key} className="flex-1 min-w-10 py-2.5 border-r last:border-r-0 border-slate-300">
                    {key}
                  </div>
                ))}
              </div>

              {/* Checkbox Row */}
              <div className="flex text-center bg-white">
                <div className="w-12 border-r border-slate-300 bg-slate-50/50 flex items-center justify-center" />
                {keys.map((key) => {
                  const isChecked = currentChars.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleChar(key)}
                      className="flex-1 min-w-10 py-4 border-r last:border-r-0 border-slate-300 hover:bg-slate-50/50 transition-colors flex items-center justify-center cursor-pointer group"
                    >
                      <div className={`w-8 h-8 border-2 rounded flex items-center justify-center transition-all ${
                        isChecked 
                          ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-inner scale-105' 
                          : 'border-slate-300 bg-white group-hover:border-slate-400'
                      }`}>
                        {isChecked && (
                          <span className="font-extrabold text-sm font-sans select-none animate-scale-up">X</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Example: For answer <strong>40</strong>, mark <strong>4</strong> and <strong>0</strong>.</span>
            {currentChars.length > 0 && (
              <button
                type="button"
                onClick={() => onAnswer('')}
                className="text-orange-600 hover:text-orange-500 font-semibold cursor-pointer"
              >
                Clear Marks
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
