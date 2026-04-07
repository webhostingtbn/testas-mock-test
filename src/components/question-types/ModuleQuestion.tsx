'use client';

interface ModuleQuestionProps {
  question: {
    id: string;
    content: {
      question_text: string;
      question_image?: string;
      environment_text?: string;
      environment_images?: string[];
      options: { id: string; text?: string; image?: string }[];
    };
  };
  selectedAnswer: string | null;
  onAnswer: (optionId: string) => void;
}

export default function ModuleQuestion({
  question,
  selectedAnswer,
  onAnswer,
}: ModuleQuestionProps) {
  const { question_text, question_image, environment_text, environment_images, options } = question.content;

  return (
    <div className="space-y-6">
      {/* Environment/Scheme Section (if present) */}
      {(environment_text || environment_images) && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 shadow-sm">
          <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3">
            📋 Situation / Environment
          </h3>
          {environment_text && (
            <div className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none">
              <p>{environment_text}</p>
            </div>
          )}
          {environment_images && environment_images.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4">
              {environment_images.map((img, idx) => (
                <div key={idx} className="rounded-xl border border-blue-200 overflow-hidden bg-white">
                  {img.startsWith('http') || img.startsWith('/') ? (
                    <img src={img} alt={`Environment ${idx + 1}`} className="max-h-48 object-contain" />
                  ) : (
                    <div className="w-48 h-32 flex items-center justify-center text-sm text-gray-400 bg-gray-50">
                      [Image placeholder]
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Question
        </h3>
        <p className="text-gray-800 text-base leading-relaxed mb-4">
          {question_text}
        </p>
        {question_image && (
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 inline-block">
            {question_image.startsWith('http') || question_image.startsWith('/') ? (
              <img src={question_image} alt="Question" className="max-h-64 object-contain" />
            ) : (
              <div className="w-64 h-40 flex items-center justify-center text-sm text-gray-400">
                [Image placeholder]
              </div>
            )}
          </div>
        )}
      </div>

      {/* Answer Options */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
          Select your answer
        </h3>
        <div className="space-y-3">
          {options.map((option, idx) => {
            const isSelected = selectedAnswer === option.id;
            const letter = String.fromCharCode(65 + idx);

            return (
              <button
                key={option.id}
                onClick={() => onAnswer(option.id)}
                className={`
                  w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left
                  transition-all duration-200
                  ${
                    isSelected
                      ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-100'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }
                `}
              >
                {/* Letter marker */}
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                    transition-colors duration-200
                    ${
                      isSelected
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }
                  `}
                >
                  {letter}
                </div>

                {/* Option content */}
                <div className="flex-1">
                  {option.text && (
                    <p className={`text-sm ${isSelected ? 'text-orange-900 font-medium' : 'text-gray-700'}`}>
                      {option.text}
                    </p>
                  )}
                  {option.image && (
                    <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 inline-block">
                      {option.image.startsWith('http') || option.image.startsWith('/') ? (
                        <img src={option.image} alt={`Option ${letter}`} className="max-h-32 object-contain" />
                      ) : (
                        <div className="w-32 h-20 flex items-center justify-center text-xs text-gray-400">
                          [Image]
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
