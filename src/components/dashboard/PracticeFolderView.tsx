'use client';

import { Smile, Meh, Frown, ChevronLeft, ChevronRight } from 'lucide-react';
import { KniCard, KniButton } from '@/components/KniPrimitives';

interface PracticeFolderViewProps {
  subtestTitle: string;
  counts: {
    easy: number;
    medium: number;
    hard: number;
  };
  onBack: () => void;
  onSelectFolder: (folder: 'easy' | 'medium' | 'hard') => void;
}

export default function PracticeFolderView({
  subtestTitle,
  counts,
  onBack,
  onSelectFolder,
}: PracticeFolderViewProps) {
  // Only show rated questions in practice - unclassified folder removed
  const folders = [
    {
      id: 'easy' as const,
      label: 'Easy Questions',
      labelVi: 'Thư mục câu Dễ',
      icon: Smile,
      count: counts.easy,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300',
      iconColor: 'bg-emerald-100 text-emerald-700',
      badgeColor: 'bg-emerald-500/10 text-emerald-700 border-emerald-300/35',
    },
    {
      id: 'medium' as const,
      label: 'Medium Questions',
      labelVi: 'Thư mục câu Vừa',
      icon: Meh,
      count: counts.medium,
      color: 'bg-amber-50/50 text-amber-700 border-amber-200 hover:border-amber-300',
      iconColor: 'bg-amber-100 text-amber-700',
      badgeColor: 'bg-amber-500/10 text-amber-750 border-amber-300/35',
    },
    {
      id: 'hard' as const,
      label: 'Hard Questions',
      labelVi: 'Thư mục câu Khó',
      icon: Frown,
      count: counts.hard,
      color: 'bg-rose-50/50 text-rose-700 border-rose-200 hover:border-rose-300',
      iconColor: 'bg-rose-100 text-rose-700',
      badgeColor: 'bg-rose-500/10 text-rose-750 border-rose-300/35',
    },
  ];

  return (
    <div className="mx-auto w-full">
      <div className="mb-8">
        <p className="text-sm font-medium text-orange-700">Practice Folders</p>
        <h2 className="mt-1 text-3xl font-bold text-slate-900">{subtestTitle}</h2>
        <p className="mt-2 text-slate-500">
          Select a difficulty folder to practice. Only rated questions appear here.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-3">
        {folders.map((folder) => {
          const Icon = folder.icon;
          const isEmpty = folder.count === 0;

          return (
            <KniCard
              key={folder.id}
              className={`flex flex-col p-5 border min-h-64 justify-between bg-white relative transition-all duration-300 ${folder.color}`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className={`grid size-12 place-items-center rounded-2xl ${folder.iconColor} shadow-xs`}>
                    <Icon className="size-6" />
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${folder.badgeColor}`}>
                    {folder.count} Question{folder.count === 1 ? '' : 's'}
                  </span>
                </div>

                <h3 className="mt-6 text-lg font-bold text-slate-900 leading-tight">{folder.label}</h3>
                <p className="mt-1 text-xs text-slate-400 font-medium">{folder.labelVi}</p>
              </div>

              <KniButton
                type="button"
                disabled={isEmpty}
                onClick={() => onSelectFolder(folder.id)}
                variant={folder.id === 'hard' ? 'danger' : 'primary'}
                className="mt-6 w-full h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 hover:scale-102 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none"
              >
                {isEmpty ? 'No Questions' : 'Start Practice'}
                {!isEmpty && <ChevronRight className="size-4" />}
              </KniButton>
            </KniCard>
          );
        })}
      </div>
    </div>
  );
}
