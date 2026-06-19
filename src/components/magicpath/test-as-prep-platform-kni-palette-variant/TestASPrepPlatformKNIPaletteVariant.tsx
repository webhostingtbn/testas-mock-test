import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, Calculator, Check, ChevronRight, ClipboardCheck, Clock3, FileText, Gauge, GraduationCap, ImagePlus, Languages, LayoutDashboard, Lock, LogIn, Maximize2, PenLine, Plus, Radar, Save, Search, Settings2, ShieldCheck, Sparkles, Timer, Upload, Users, Volume2, Wifi, X } from 'lucide-react';
type View = 'landing' | 'pending' | 'dashboard' | 'practiceBins' | 'practice' | 'mockBriefing' | 'mock' | 'adminUsers' | 'adminCms';
type Language = 'en' | 'de';
type AuthTarget = 'pending' | 'student';
type Difficulty = 'easy' | 'medium' | 'hard';
const copy = {
  en: {
    signIn: 'Continue with Google',
    pending: 'Account Pending Approval',
    dashboard: 'Dashboard',
    practice: 'Practice',
    mock: 'Mock Test',
    users: 'Users',
    cms: 'CMS',
    overall: 'Overall Bank Progress',
    correct: 'Correct',
    startMock: 'Start Mock Test',
    practiceBins: 'Practice Bins',
    radar: 'Proficiency Radar',
    latest: 'Latest score',
    search: 'Search users by email or name...',
    save: 'Save Question'
  },
  de: {
    signIn: 'Mit Google fortfahren',
    pending: 'Konto wartet auf Freigabe',
    dashboard: 'Ubersicht',
    practice: 'Uben',
    mock: 'Probetest',
    users: 'Nutzer',
    cms: 'Fragen-CMS',
    overall: 'Gesamtfortschritt',
    correct: 'Richtig',
    startMock: 'Probetest starten',
    practiceBins: 'Ubungsordner',
    radar: 'Kompetenzradar',
    latest: 'Letzte Punktzahl',
    search: 'Nutzer nach E-Mail oder Name suchen...',
    save: 'Frage speichern'
  }
};
const subtests = [{
  title: 'Figure Sequences',
  score: 85,
  attempts: '2 days ago',
  icon: Sparkles,
  color: '#EA580C'
}, {
  title: 'Math Equations',
  score: 72,
  attempts: '5 days ago',
  icon: PenLine,
  color: '#F97316'
}, {
  title: 'Latin Squares',
  score: 91,
  attempts: 'Yesterday',
  icon: LayoutDashboard,
  color: '#10B981'
}, {
  title: 'Quantitative Problems',
  score: 64,
  attempts: '1 week ago',
  icon: Gauge,
  color: '#F59E0B'
}, {
  title: 'Text Completion',
  score: 77,
  attempts: '3 days ago',
  icon: FileText,
  color: '#EF4444'
}];
const questions = [{
  stem: 'A sequence alternates between rotation and reflection. Which figure completes the fifth frame?',
  equation: 'r(n) = 90deg x n, mirror on odd n',
  options: ['Figure A', 'Figure B', 'Figure C', 'Figure D']
}, {
  stem: 'Solve for x in the constraint system while preserving the admission score threshold.',
  equation: '3x + 2y = 24, y = x - 2',
  options: ['x = 4', 'x = 5', 'x = 6', 'x = 8']
}, {
  stem: 'A Latin square row contains A, B, C, D. Which symbol is missing from the highlighted cell?',
  equation: 'row3 intersect col2 != row symbols or column symbols',
  options: ['A', 'B', 'C', 'D']
}];
const preparationItems = [{
  id: 'internet',
  label: 'Stable internet connection',
  description: 'Your connection is ready for continuous answer syncing.',
  icon: Wifi
}, {
  id: 'environment',
  label: 'Quiet testing environment',
  description: 'Notifications are muted and interruptions are minimized.',
  icon: Volume2
}, {
  id: 'fullscreen',
  label: 'Full-screen mode ready',
  description: 'You can focus on the exam without switching windows.',
  icon: Maximize2
}, {
  id: 'materials',
  label: 'Material restrictions understood',
  description: 'Only permitted calculators and reference materials are nearby.',
  icon: Calculator
}, {
  id: 'timer',
  label: 'No-pause rule accepted',
  description: 'You understand the timer cannot be paused after starting.',
  icon: Timer
}];
const usersSeed = [{
  name: 'Lena Hoffmann',
  email: 'lena.h@testas.dev',
  status: 'Pending',
  modules: ['CS'],
  format: 'Digital'
}, {
  name: 'Minh Tran',
  email: 'minh@testas.dev',
  status: 'Approved',
  modules: ['CS', 'Engineering'],
  format: 'Paper'
}, {
  name: 'Jonas Weber',
  email: 'jonas@testas.dev',
  status: 'Rejected',
  modules: ['Economics'],
  format: 'Digital'
}];
const classNames = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(' ');
function GlassCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={classNames('rounded-2xl border border-orange-100/60 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur-sm', 'transition-all duration-300 hover:border-orange-200 hover:bg-white/90', className)}>
      {children}
    </div>;
}
function DarkGlassCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={classNames('rounded-2xl border border-white/10 bg-slate-900/70 shadow-xl shadow-slate-950/80 backdrop-blur-sm', className)}>
      {children}
    </div>;
}
function IconButton({
  children,
  active,
  onClick,
  title
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
}) {
  return <button type="button" title={title} onClick={onClick} className={classNames('grid size-11 place-items-center rounded-xl border transition-all duration-200', active ? 'border-orange-300/70 bg-orange-600 text-white shadow-lg shadow-orange-500/20' : 'border-slate-200/70 bg-white/70 text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-slate-950')}>
      {children}
    </button>;
}
function LanguageToggle({
  lang,
  setLang
}: {
  lang: Language;
  setLang: (lang: Language) => void;
}) {
  return <button type="button" onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="inline-flex items-center gap-2 rounded-full border border-orange-100/70 bg-white/80 px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:border-orange-300/60 hover:bg-orange-50" aria-label="Toggle language">
      <Languages className="size-4" />
      <span>{lang === 'en' ? 'Eng' : 'De'}</span>
    </button>;
}
function RadarChart() {
  const center = 128;
  const radius = 92;
  const values = subtests.map(item => item.score / 100);
  const points = values.map((value, index) => {
    const angle = Math.PI * 2 * index / values.length - Math.PI / 2;
    return `${center + Math.cos(angle) * radius * value},${center + Math.sin(angle) * radius * value}`;
  }).join(' ');
  const grid = [0.25, 0.5, 0.75, 1].map(scale => subtests.map((_, index) => {
    const angle = Math.PI * 2 * index / subtests.length - Math.PI / 2;
    return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
  }).join(' '));
  return <svg viewBox="0 0 256 256" className="h-64 w-full max-w-sm overflow-visible">
      <defs>
        <linearGradient id="radarFill" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#EA580C" stopOpacity="0.58" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0.38" />
        </linearGradient>
      </defs>
      {grid.map((poly, index) => <polygon key={index} points={poly} fill="none" stroke="rgba(15,23,42,.14)" strokeWidth="1" />)}
      {subtests.map((item, index) => {
      const angle = Math.PI * 2 * index / subtests.length - Math.PI / 2;
      const x = center + Math.cos(angle) * (radius + 22);
      const y = center + Math.sin(angle) * (radius + 22);
      return <g key={item.title}>
            <line x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="rgba(15,23,42,.12)" />
            <circle cx={center + Math.cos(angle) * radius * (item.score / 100)} cy={center + Math.sin(angle) * radius * (item.score / 100)} r="4" fill={item.color} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-600 text-[9px] font-medium">
              {item.title.split(' ')[0]}
            </text>
          </g>;
    })}
      <polygon points={points} fill="url(#radarFill)" stroke="#F97316" strokeWidth="2" />
    </svg>;
}
function Sidebar({
  view,
  setView,
  t
}: {
  view: View;
  setView: (view: View) => void;
  t: typeof copy.en;
}) {
  const nav = [{
    view: 'dashboard' as View,
    icon: LayoutDashboard,
    label: t.dashboard
  }, {
    view: 'practiceBins' as View,
    icon: BookOpen,
    label: t.practice
  }, {
    view: 'mockBriefing' as View,
    icon: Timer,
    label: t.mock
  }, {
    view: 'adminUsers' as View,
    icon: Users,
    label: t.users
  }, {
    view: 'adminCms' as View,
    icon: FileText,
    label: t.cms
  }];
  return <aside className="hidden w-20 shrink-0 flex-col items-center gap-3 border-r border-orange-100/70 bg-white/60 px-3 py-5 backdrop-blur-xl md:flex">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 shadow-lg shadow-orange-500/25">
        <GraduationCap className="size-6 text-white" />
      </div>
      {nav.map(item => <IconButton key={item.view} title={item.label} active={view === item.view} onClick={() => setView(item.view)}>
          <item.icon className="size-5" />
        </IconButton>)}
    </aside>;
}
export const TestASPrepPlatformKNIPaletteVariant = () => {
  const [view, setView] = useState<View>('landing');
  const [lang, setLang] = useState<Language>('en');
  const [authTarget, setAuthTarget] = useState<AuthTarget>('student');
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [practiceTime, setPracticeTime] = useState(14);
  const [rating, setRating] = useState<Difficulty | null>(null);
  const [mockTime, setMockTime] = useState(96);
  const [selectedMockSubtest, setSelectedMockSubtest] = useState(subtests[3]);
  const [briefingChecklist, setBriefingChecklist] = useState<string[]>([]);
  const [isEligible, setIsEligible] = useState(true);
  const [users, setUsers] = useState(usersSeed);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [selectedModules, setSelectedModules] = useState(['CS', 'Engineering']);
  const [form, setForm] = useState({
    subtest: 'Figure Sequences',
    question: 'Which figure continues the pattern after a 90 degree clockwise rotation?',
    answer: 'B',
    explanation: 'The figure rotates by 90 degrees while alternating the shaded segment.'
  });
  const t = copy[lang];
  const currentQuestion = questions[activeQuestion % questions.length];
  const easyLocked = practiceTime <= 0;
  useEffect(() => {
    if (view !== 'practice') return;
    const interval = window.setInterval(() => setPracticeTime(time => Math.max(0, time - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [view]);
  useEffect(() => {
    if (view !== 'mock' || mockTime <= 0) return;
    const interval = window.setInterval(() => setMockTime(time => Math.max(0, time - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [view, mockTime]);
  const mockClock = useMemo(() => {
    const minutes = Math.floor(mockTime / 60).toString().padStart(2, '0');
    const seconds = (mockTime % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [mockTime]);
  const rateQuestion = (nextRating: Difficulty) => {
    if (nextRating === 'easy' && easyLocked) return;
    setRating(nextRating);
    window.setTimeout(() => {
      setPracticeTime(14);
      setActiveQuestion(index => index + 1);
      setRating(null);
    }, 520);
  };
  const startPractice = () => {
    setPracticeTime(14);
    setRating(null);
    setView('practice');
  };
  const toggleUserStatus = (index: number, status: string) => {
    setUsers(items => items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      status
    } : item));
  };
  const toggleModule = (module: string) => {
    setSelectedModules(items => items.includes(module) ? items.filter(item => item !== module) : [...items, module]);
  };
  const saveQuestion = () => {
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 2200);
  };
  const openMockBriefing = (subtest: (typeof subtests)[number]) => {
    setSelectedMockSubtest(subtest);
    setBriefingChecklist([]);
    setIsEligible(true);
    setView('mockBriefing');
  };
  const toggleBriefingItem = (itemId: string) => {
    setBriefingChecklist(items => items.includes(itemId) ? items.filter(id => id !== itemId) : [...items, itemId]);
  };
  const startMockTest = () => {
    if (!isEligible || briefingChecklist.length !== preparationItems.length) return;
    setMockTime(96);
    setActiveQuestion(0);
    setView('mock');
  };

  // ── MOCK TEST SCREEN — completely untouched ──────────────────────────────
  if (view === 'mock') {
    return <main className="h-screen w-full overflow-hidden bg-[#0B0F19] text-slate-100">
        <div className="flex h-full flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 backdrop-blur-xl md:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <button type="button" aria-label="Back to mock briefing" onClick={() => setView('mockBriefing')} className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] transition hover:bg-white/[0.1]">
                <ArrowLeft className="size-5" />
              </button>
              <div className="min-w-0">
                <p className="text-sm text-slate-400">Section 1</p>
                <h1 className="truncate text-lg font-semibold md:text-xl">{selectedMockSubtest.title}</h1>
              </div>
              <div className="hidden gap-1 md:flex">
                {[1, 2, 3, 4, 5, 6].map(dot => <span key={dot} className={classNames('size-2 rounded-full', dot <= 3 ? 'bg-orange-500' : 'bg-white/20')} />)}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-2 text-xl font-semibold text-rose-100 shadow-lg shadow-rose-500/10">
              {mockClock}
            </div>
            <button type="button" onClick={() => setMockTime(0)} className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-500">
              Submit & Next Section
            </button>
          </header>
          <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-[0.9fr_1.1fr] md:p-6">
            <DarkGlassCard className="min-h-0 overflow-auto p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-orange-600/20 text-orange-700">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Exam Instructions</h2>
                  <p className="text-sm text-slate-400">No self-assessment ratings are shown in mock mode.</p>
                </div>
              </div>
              <div className="space-y-4 text-sm leading-7 text-slate-300">
                <p>Read the schema and answer all questions in the current subtest. Answers are saved automatically when you move between questions.</p>
                <p>Use the diagram rules below. The highlighted region rotates clockwise every step. Reflection occurs only after the second frame.</p>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map(item => <div key={item} className="aspect-square rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-violet-500/10 p-3">
                      <div className="h-full rounded-xl border border-white/15 bg-white/[0.04]">
                        <div className={classNames('h-1/2 w-1/2 rounded-lg bg-orange-400/80', item === 1 && 'ml-auto', item === 2 && 'ml-auto mt-auto')} />
                      </div>
                    </div>)}
                </div>
              </div>
            </DarkGlassCard>
            <DarkGlassCard className="min-h-0 overflow-auto p-6">
              <div className="mb-6 flex items-center justify-between">
                <span className="rounded-full border border-orange-300/50 bg-orange-600/15 px-3 py-1 text-sm text-orange-800">Question 3 of 20</span>
                <span className="text-sm text-slate-400">Autosaved 12s ago</span>
              </div>
              <h2 className="mb-6 text-2xl font-semibold leading-snug">A rectangle is scaled by 1.5x and then rotated. Which answer preserves the same area ratio?</h2>
              <div className="grid gap-3">
                {['A. 2.25', 'B. 1.50', 'C. 3.00', 'D. 0.75'].map((option, index) => <button key={option} type="button" className={classNames('rounded-2xl border p-4 text-left transition', index === 0 ? 'border-orange-400/70 bg-orange-600/20' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]')}>
                    {option}
                  </button>)}
              </div>
            </DarkGlassCard>
          </section>
          <footer className="flex h-20 shrink-0 items-center justify-between border-t border-white/10 bg-slate-950/80 px-4 md:px-8">
            <button type="button" className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.08]">Previous</button>
            <div className="text-sm text-slate-400">Strict exam interface: no page scrolling, hidden ratings</div>
            <button type="button" className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-100">Next Question</button>
          </footer>
        </div>
        {mockTime <= 0 && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-md">
            <DarkGlassCard className="w-full max-w-md p-8 text-center">
              <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-rose-500/20 text-rose-200">
                <AlertTriangle className="size-8" />
              </div>
              <h2 className="text-3xl font-semibold text-rose-100">Time is Up!</h2>
              <p className="mt-3 text-slate-300">Your answers have been auto-saved. Proceeding to the next section...</p>
              <button type="button" onClick={() => {
            setMockTime(96);
            setView('dashboard');
          }} className="mt-6 w-full rounded-xl bg-rose-500 px-5 py-3 font-semibold text-white transition hover:bg-rose-400">
                Proceed
              </button>
            </DarkGlassCard>
          </div>}
      </main>;
  }

  // ── LIGHT-THEMED VIEWS ───────────────────────────────────────────────────
  return <main className="kni-light min-h-screen w-full overflow-hidden bg-orange-50 text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(234,88,12,.14),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(245,158,11,.16),transparent_28%),linear-gradient(135deg,#fff7ed,#ffffff_46%,#fffbeb)]" />
      <div className="relative flex min-h-screen">
        {view !== 'landing' && view !== 'pending' && <Sidebar view={view} setView={setView} t={t} />}
        <section className="flex min-w-0 flex-1 flex-col">
          <Header lang={lang} setLang={setLang} view={view} setView={setView} t={t} />
          <div className="flex-1 p-4 md:p-8">
            {view === 'landing' && <Landing t={t} lang={lang} setLang={setLang} authTarget={authTarget} setAuthTarget={setAuthTarget} onContinue={() => setView(authTarget === 'pending' ? 'pending' : 'dashboard')} />}
            {view === 'pending' && <Pending t={t} onBack={() => setView('landing')} />}
            {view === 'dashboard' && <Dashboard t={t} setView={setView} onStartMock={openMockBriefing} />}
            {view === 'mockBriefing' && <MockBriefing subtest={selectedMockSubtest} checklist={briefingChecklist} isEligible={isEligible} onToggleEligibility={() => setIsEligible(value => !value)} onToggleItem={toggleBriefingItem} onBack={() => setView('dashboard')} onStart={startMockTest} />}
            {view === 'practiceBins' && <PracticeBins setView={setView} onStart={startPractice} />}
            {view === 'practice' && <PracticeArena question={currentQuestion} activeQuestion={activeQuestion} practiceTime={practiceTime} easyLocked={easyLocked} rating={rating} onRate={rateQuestion} onBack={() => setView('practiceBins')} />}
            {view === 'adminUsers' && <AdminUsers t={t} users={users} onStatus={toggleUserStatus} />}
            {view === 'adminCms' && <AdminCms t={t} form={form} setForm={setForm} modules={selectedModules} toggleModule={toggleModule} saveState={saveState} saveQuestion={saveQuestion} />}
          </div>
        </section>
      </div>
    </main>;
};
function Header({
  lang,
  setLang,
  view,
  setView,
  t
}: {
  lang: Language;
  setLang: (lang: Language) => void;
  view: View;
  setView: (view: View) => void;
  t: typeof copy.en;
}) {
  if (view === 'landing') return null;
  const nav = [{
    view: 'dashboard' as View,
    label: t.dashboard
  }, {
    view: 'practiceBins' as View,
    label: t.practice
  }, {
    view: 'mockBriefing' as View,
    label: t.mock
  }, {
    view: 'adminUsers' as View,
    label: t.users
  }, {
    view: 'adminCms' as View,
    label: t.cms
  }];
  return <header className="relative z-10 flex items-center justify-between border-b border-orange-100/70 bg-white/70 px-4 py-4 backdrop-blur-xl md:px-8">
      <button type="button" onClick={() => setView('dashboard')} className="flex min-w-0 items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 shadow-lg shadow-orange-500/25">
          <GraduationCap className="size-6 text-white" />
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-sm text-slate-500">mocktest.kni.vn</p>
          <h1 className="truncate text-lg font-semibold">TestAS Prep Platform</h1>
        </div>
      </button>
      <nav className="mx-4 hidden flex-1 justify-center gap-1 lg:flex" aria-label="Primary prototype navigation">
        {nav.map(item => <button key={item.view} type="button" onClick={() => setView(item.view)} className={classNames('rounded-full px-3 py-2 text-sm font-medium transition', view === item.view ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' : 'text-slate-600 hover:bg-orange-50 hover:text-slate-950')}>
            {item.label}
          </button>)}
      </nav>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:flex">
          <ShieldCheck className="size-4" />
          Computer Science
        </div>
        <LanguageToggle lang={lang} setLang={setLang} />
        <button type="button" onClick={() => setView('landing')} className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 font-bold text-slate-950" title={t.signIn}>
          M
        </button>
      </div>
    </header>;
}
function Landing({
  t,
  lang,
  setLang,
  authTarget,
  setAuthTarget,
  onContinue
}: {
  t: typeof copy.en;
  lang: Language;
  setLang: (lang: Language) => void;
  authTarget: AuthTarget;
  setAuthTarget: (value: AuthTarget) => void;
  onContinue: () => void;
}) {
  return <div className="grid min-h-[calc(100vh-2rem)] place-items-center">
      <div className="absolute right-5 top-5">
        <LanguageToggle lang={lang} setLang={setLang} />
      </div>
      <GlassCard className="w-full max-w-xl p-7 text-center md:p-10">
        <div className="mx-auto mb-6 grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-orange-600 to-amber-500 shadow-2xl shadow-orange-500/25">
          <GraduationCap className="size-10 text-white" />
        </div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/60 bg-orange-600/10 px-3 py-1 text-sm text-orange-800">
          <Sparkles className="size-4" />
          Premium TestAS preparation
        </div>
        <h1 className="text-4xl font-semibold leading-tight md:text-6xl">TestAS Prep Platform</h1>
        {/* subtitle: text-slate-300 → text-slate-500 */}
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-500">Your ultimate gateway to German university admissions.</p>
        {/* auth toggle container: border-white/10 bg-white/[0.04] → border-orange-200 bg-orange-50 */}
        <div className="mt-7 grid grid-cols-2 gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-2">
          {(['student', 'pending'] as AuthTarget[]).map(target => <button key={target} type="button" onClick={() => setAuthTarget(target)} className={classNames('rounded-xl px-4 py-3 text-sm font-semibold transition', authTarget === target ? 'bg-white text-slate-950' : 'text-slate-500 hover:bg-orange-100')}>
              {target === 'student' ? 'Student demo' : 'Pending demo'}
            </button>)}
        </div>
        <button type="button" onClick={onContinue} className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 font-semibold text-slate-950 shadow-xl shadow-white/10 transition hover:-translate-y-0.5 hover:bg-orange-50">
          <span className="grid size-7 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">G</span>
          {t.signIn}
          <LogIn className="size-5" />
        </button>
      </GlassCard>
    </div>;
}
function Pending({
  t,
  onBack
}: {
  t: typeof copy.en;
  onBack: () => void;
}) {
  return <div className="grid min-h-[calc(100vh-9rem)] place-items-center">
      <GlassCard className="w-full max-w-lg p-8 text-center">
        {/* clock icon: text-amber-100 → text-amber-600 */}
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border border-amber-300/30 bg-amber-500/15 text-amber-600">
          <Clock3 className="size-8" />
        </div>
        {/* badge: text-amber-100 → text-amber-700 */}
        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-700">Pending</span>
        <h2 className="mt-5 text-3xl font-semibold">{t.pending}</h2>
        {/* body text: text-slate-300 → text-slate-500 */}
        <p className="mt-4 text-slate-500">An administrator is reviewing your registration. Once approved, you will gain access to your allocated modules.</p>
        {/* return button: border-white/10 text-slate-100 hover:bg-white/[0.08] → border-orange-300 text-slate-700 hover:bg-orange-100 */}
        <button type="button" onClick={onBack} className="mt-7 rounded-xl border border-orange-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-orange-100">
          Return to Sign In
        </button>
      </GlassCard>
    </div>;
}
function MockBriefing({
  subtest,
  checklist,
  isEligible,
  onToggleEligibility,
  onToggleItem,
  onBack,
  onStart
}: {
  subtest: (typeof subtests)[number];
  checklist: string[];
  isEligible: boolean;
  onToggleEligibility: () => void;
  onToggleItem: (itemId: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const readyCount = checklist.length;
  const isReady = isEligible && readyCount === preparationItems.length;
  const examDetails = [{
    label: 'Sections',
    value: '1 focused subtest'
  }, {
    label: 'Questions',
    value: '20 questions'
  }, {
    label: 'Time limit',
    value: '20 minutes'
  }, {
    label: 'Scoring',
    value: '1 point per correct answer'
  }, {
    label: 'Format',
    value: 'Digital'
  }];
  return <div className="mx-auto w-full max-w-7xl">
      <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white/70 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-orange-300 hover:bg-orange-50">
        <ArrowLeft className="size-4" />
        Back to Dashboard
      </button>
      <div className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <div className="space-y-5">
          <GlassCard className="overflow-hidden">
            <div className="border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 md:p-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-orange-700">
                  <ClipboardCheck className="size-4" />
                  Mock Test Briefing
                </span>
                <button type="button" onClick={onToggleEligibility} aria-pressed={isEligible} className={classNames('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition', isEligible ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100')}>
                  {isEligible ? <Check className="size-4" /> : <X className="size-4" />}
                  {isEligible ? 'You are eligible' : 'You are not eligible'}
                </button>
              </div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl shadow-lg" style={{
                backgroundColor: `${subtest.color}18`,
                color: subtest.color
              }}>
                  <subtest.icon className="size-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-700">Computer Science Module</p>
                  <h2 className="mt-1 text-3xl font-semibold md:text-4xl">{subtest.title}</h2>
                  <p className="mt-2 text-slate-500">Your latest score is {subtest.score}%. Review the setup below before beginning a timed attempt.</p>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Preparation checklist</p>
                  <h3 className="text-2xl font-semibold">Get ready to focus</h3>
                </div>
                <span className={classNames('rounded-full px-3 py-1 text-sm font-semibold', readyCount === preparationItems.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {readyCount} of {preparationItems.length} ready
                </span>
              </div>
              <div className="grid gap-3">
                {preparationItems.map(item => {
                const checked = checklist.includes(item.id);
                return <button key={item.id} type="button" aria-pressed={checked} onClick={() => onToggleItem(item.id)} className={classNames('flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition', checked ? 'border-emerald-200 bg-emerald-50/80 shadow-sm' : 'border-orange-100 bg-white/70 hover:border-orange-200 hover:bg-orange-50/70')}>
                    <span className={classNames('mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl transition', checked ? 'bg-emerald-500 text-white' : 'bg-orange-100 text-orange-700')}>
                      {checked ? <Check className="size-5" /> : <item.icon className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={classNames('block font-semibold', checked ? 'text-emerald-800' : 'text-slate-900')}>{item.label}</span>
                      <span className="mt-1 block text-sm leading-5 text-slate-500">{item.description}</span>
                    </span>
                  </button>;
              })}
              </div>
            </div>
          </GlassCard>
        </div>
        <div className="space-y-5">
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-orange-100 text-orange-700">
                <FileText className="size-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Attempt overview</p>
                <h3 className="text-2xl font-semibold">Exam details</h3>
              </div>
            </div>
            <div className="divide-y divide-orange-100">
              {examDetails.map(detail => <div key={detail.label} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="text-sm text-slate-500">{detail.label}</span>
                  <span className="text-right text-sm font-semibold text-slate-900">{detail.value}</span>
                </div>)}
            </div>
          </GlassCard>
          <GlassCard className="p-6">
            <div className={classNames('rounded-2xl border p-4', isEligible ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50')}>
              <div className="flex items-start gap-3">
                <div className={classNames('grid size-10 shrink-0 place-items-center rounded-xl', isEligible ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                  {isEligible ? <ShieldCheck className="size-5" /> : <AlertTriangle className="size-5" />}
                </div>
                <div>
                  <p className={classNames('font-semibold', isEligible ? 'text-emerald-800' : 'text-rose-800')}>{isEligible ? 'Eligibility confirmed' : 'Access restricted'}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{isEligible ? 'Your approved Computer Science allocation includes this digital mock test.' : 'Ask an administrator to approve this module before starting the mock test.'}</p>
                </div>
              </div>
            </div>
            <button type="button" disabled={!isReady} onClick={onStart} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-4 font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none">
              <Timer className="size-5" />
              Start Mock Test
              <ChevronRight className="size-5" />
            </button>
            <p className="mt-3 text-center text-sm text-rose-600">Once started, the timer cannot be paused.</p>
            {!isReady && <p className="mt-2 text-center text-xs text-slate-500">{!isEligible ? 'Eligibility is required to continue.' : `Complete ${preparationItems.length - readyCount} more preparation item${preparationItems.length - readyCount === 1 ? '' : 's'} to continue.`}</p>}
          </GlassCard>
        </div>
      </div>
    </div>;
}
function Dashboard({
  t,
  setView,
  onStartMock
}: {
  t: typeof copy.en;
  setView: (view: View) => void;
  onStartMock: (subtest: (typeof subtests)[number]) => void;
}) {
  return <div className="mx-auto grid w-full max-w-7xl gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-orange-700">Student Home</p>
          <h2 className="mt-1 text-3xl font-semibold md:text-5xl">{t.dashboard}</h2>
        </div>
        {subtests.map(item => <GlassCard key={item.title} className="p-4 md:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{
            backgroundColor: `${item.color}22`,
            color: item.color
          }}>
                <item.icon className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <span className="text-sm text-slate-400">{t.latest}: {item.score}%</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">Last attempt: {item.score}% - {item.attempts}</p>
                {/* progress bar track: bg-white/10 → bg-orange-100 */}
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-orange-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{
                width: `${item.score}%`
              }} />
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => onStartMock(item)} className="rounded-xl border border-orange-300/50 px-3 py-2 text-sm font-semibold text-orange-800 transition hover:bg-orange-600/15">
                  {t.startMock}
                </button>
                <button type="button" onClick={() => setView('practiceBins')} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-50">
                  {t.practiceBins}
                </button>
              </div>
            </div>
          </GlassCard>)}
      </div>
      <div className="space-y-5">
        <GlassCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">{t.radar}</p>
              <h3 className="text-2xl font-semibold">Module mastery</h3>
            </div>
            <Radar className="size-6 text-orange-700" />
          </div>
          <div className="flex justify-center">
            <RadarChart />
          </div>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-center gap-5">
            <div className="relative grid size-32 place-items-center rounded-full">
              <svg className="absolute inset-0 size-32 -rotate-90" viewBox="0 0 120 120">
                {/* donut track: stroke rgba(255,255,255,.1) → rgba(234,88,12,.12) */}
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(234,88,12,.12)" strokeWidth="12" />
                <circle cx="60" cy="60" r="48" fill="none" stroke="#EA580C" strokeWidth="12" strokeLinecap="round" strokeDasharray="301.6" strokeDashoffset="108.6" />
              </svg>
              <div className="text-center">
                <div className="text-3xl font-bold">64%</div>
                <div className="text-xs text-slate-400">{t.correct}</div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-semibold">{t.overall}</h3>
              {/* "128 of 200": text-slate-300 → text-slate-500 */}
              <p className="mt-2 text-slate-500">128 of 200 questions solved</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {/* module tags: border-white/10 bg-white/[0.06] text-slate-200 → border-orange-200 bg-orange-50 text-slate-600 */}
                {['CS', 'Economics', 'Engineering'].map(tag => <span key={tag} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-slate-600">{tag}</span>)}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>;
}
function PracticeBins({
  setView,
  onStart
}: {
  setView: (view: View) => void;
  onStart: () => void;
}) {
  const bins = [{
    id: 'easy',
    label: 'Easy Bin',
    count: 12,
    color: 'emerald',
    icon: Check
  }, {
    id: 'medium',
    label: 'Medium Bin',
    count: 24,
    color: 'amber',
    icon: Clock3
  }, {
    id: 'hard',
    label: 'Hard Bin',
    count: 8,
    color: 'rose',
    icon: AlertTriangle
  }];
  // text-emerald/amber/rose-100 → *-700; border-*-300/20 → border-*-200
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500/25 to-emerald-400/5 text-emerald-700 border-emerald-200',
    amber: 'from-amber-500/25 to-amber-400/5 text-amber-700 border-amber-200',
    rose: 'from-rose-500/25 to-rose-400/5 text-rose-700 border-rose-200'
  };
  return <div className="mx-auto w-full max-w-7xl">
      {/* back button: border-white/10 text-slate-200 hover:bg-white/[0.08] → border-orange-200 text-slate-600 hover:bg-orange-100 */}
      <button type="button" onClick={() => setView('dashboard')} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-orange-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-orange-100">
        <ArrowLeft className="size-4" />
        Back
      </button>
      <div className="mb-8">
        <p className="text-sm text-orange-700">Subtest: Latin Squares</p>
        <h2 className="mt-1 text-4xl font-semibold">Choose a practice folder</h2>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {bins.map(bin => <button key={bin.id} type="button" onClick={onStart} className={classNames('group rounded-3xl border bg-gradient-to-br p-6 text-left shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-1', colorMap[bin.color])}>
            <div className="mb-16 flex items-center justify-between">
              {/* icon container: bg-white/10 → bg-white/60 */}
              <div className="grid size-14 place-items-center rounded-2xl bg-white/60">
                <bin.icon className="size-7" />
              </div>
              <ChevronRight className="size-6 transition group-hover:translate-x-1" />
            </div>
            <h3 className="text-2xl font-semibold">{bin.label}</h3>
            <p className="mt-2 text-sm opacity-80">{bin.count} Questions</p>
          </button>)}
      </div>
    </div>;
}
function PracticeArena({
  question,
  activeQuestion,
  practiceTime,
  easyLocked,
  rating,
  onRate,
  onBack
}: {
  question: (typeof questions)[number];
  activeQuestion: number;
  practiceTime: number;
  easyLocked: boolean;
  rating: Difficulty | null;
  onRate: (rating: Difficulty) => void;
  onBack: () => void;
}) {
  return <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl flex-col">
      <div className="mb-5 flex items-center justify-between gap-3">
        {/* back button: border-white/10 text-slate-200 hover:bg-white/[0.08] → border-orange-200 text-slate-600 hover:bg-orange-100 */}
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-orange-100">
          <ArrowLeft className="size-4" />
          Bins
        </button>
        <div className="flex items-center gap-3">
          {/* question count pill: border-white/10 bg-white/[0.06] → border-orange-200 bg-orange-50 */}
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-sm">Question {activeQuestion % questions.length + 1} of 20</span>
          <span className={classNames('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold', easyLocked ? 'border-rose-300/30 bg-rose-500/15 text-rose-700' : 'border-orange-300/50 bg-orange-600/15 text-orange-800')}>
            <Timer className="size-4" />
            {practiceTime}s left
          </span>
        </div>
      </div>
      <GlassCard className={classNames('flex flex-1 flex-col p-5 transition-all duration-500 md:p-8', rating && 'translate-x-8 scale-95 opacity-30')}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Dynamic viewport with equation and diagram</p>
            <h2 className="mt-2 text-2xl font-semibold leading-snug md:text-3xl">{question.stem}</h2>
          </div>
          <div className="hidden rounded-2xl border border-orange-200/60 bg-orange-600/10 px-4 py-3 text-orange-800 md:block">{question.equation}</div>
        </div>
        <div className="grid flex-1 gap-5 md:grid-cols-[.8fr_1fr]">
          {/* diagram box: border-white/10 bg-slate-950/40 → border-orange-200 bg-orange-50 */}
          <div className="grid min-h-56 place-items-center rounded-3xl border border-orange-200 bg-orange-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map(cell => <div key={cell} className="grid size-20 place-items-center rounded-2xl border border-orange-200 bg-white">
                  <div className={classNames('size-9 rounded-xl', cell % 2 ? 'bg-violet-400/80' : 'bg-orange-500/80', cell === 3 && 'rotate-45')} />
                </div>)}
            </div>
          </div>
          <div className="grid content-center gap-3">
            {/* answer options: border-white/10 bg-white/[0.04] → border-orange-200 bg-white hover:bg-orange-50 */}
            {question.options.map(option => <button key={option} type="button" className="rounded-2xl border border-orange-200 bg-white p-4 text-left transition hover:border-orange-300/50 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300/60">
                {option}
              </button>)}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <RatingButton label="Easy" color="emerald" disabled={easyLocked} onClick={() => onRate('easy')} />
          <RatingButton label="Medium" color="amber" onClick={() => onRate('medium')} />
          <RatingButton label="Hard" color="rose" onClick={() => onRate('hard')} />
        </div>
      </GlassCard>
      {rating && <div className="pointer-events-none fixed right-8 top-28 rounded-2xl border border-orange-200 bg-white px-5 py-3 font-semibold text-slate-950 shadow-2xl animate-in slide-in-from-right duration-300">
          Moving to {rating} folder...
        </div>}
    </div>;
}
function RatingButton({
  label,
  color,
  disabled,
  onClick
}: {
  label: string;
  color: 'emerald' | 'amber' | 'rose';
  disabled?: boolean;
  onClick: () => void;
}) {
  // text-*-100 → text-*-700
  const colors = {
    emerald: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25',
    amber: 'border-amber-300/30 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25',
    rose: 'border-rose-300/30 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25'
  };
  return <button type="button" disabled={disabled} onClick={onClick} className={classNames('rounded-2xl border px-4 py-4 font-semibold transition disabled:cursor-not-allowed disabled:border-slate-500/20 disabled:bg-slate-500/10 disabled:text-slate-500', colors[color])}>
      {label}
    </button>;
}
function AdminUsers({
  t,
  users,
  onStatus
}: {
  t: typeof copy.en;
  users: typeof usersSeed;
  onStatus: (index: number, status: string) => void;
}) {
  return <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm text-orange-700">Admin Console</p>
          <h2 className="mt-1 text-4xl font-semibold">User Approval Dashboard</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* search: border-white/10 bg-white/[0.06] → border-orange-200 bg-white */}
          <label className="flex min-w-72 items-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-3">
            <Search className="size-4 text-slate-400" />
            <input aria-label="Search users" placeholder={t.search} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" />
          </label>
          {/* filter button: border-white/10 hover:bg-white/[0.08] → border-orange-200 hover:bg-orange-100 */}
          <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 px-4 py-3 text-sm transition hover:bg-orange-100">
            <Settings2 className="size-4" />
            Status: All
          </button>
        </div>
      </div>
      <GlassCard className="overflow-hidden">
        {/* table header divider: border-white/10 → border-orange-100 */}
        <div className="hidden grid-cols-[1.2fr_1.2fr_.7fr_1fr_1fr_1fr] gap-4 border-b border-orange-100 px-5 py-4 text-sm text-slate-400 lg:grid">
          <span>User</span><span>Email</span><span>Status</span><span>Module Allocation</span><span>Format</span><span>Actions</span>
        </div>
        {users.map((user, index) => <div key={user.email} className="grid gap-4 border-b border-orange-100 px-5 py-5 last:border-b-0 lg:grid-cols-[1.2fr_1.2fr_.7fr_1fr_1fr_1fr] lg:items-center">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 font-semibold text-slate-950">{user.name.charAt(0)}</div>
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-slate-400">Jun 17, 2026</p>
              </div>
            </div>
            {/* user email: text-slate-300 → text-slate-500 */}
            <p className="text-sm text-slate-500">{user.email}</p>
            <StatusBadge status={user.status} />
            <div className="flex flex-wrap gap-2">
              {['CS', 'Economics', 'Engineering'].map(module => <button key={module} type="button" className={classNames('rounded-full border px-3 py-1 text-xs transition', user.modules.includes(module) ? 'border-orange-300/60 bg-orange-600/20 text-orange-800' : 'border-orange-200 bg-orange-50 text-slate-500')}>
                  {module}
                </button>)}
            </div>
            <div className="flex gap-2">
              {['Paper', 'Digital'].map(format => <button key={format} type="button" className={classNames('rounded-full border px-3 py-1 text-xs transition', user.format === format ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-700' : 'border-orange-200 bg-orange-50 text-slate-500')}>
                  {format}
                </button>)}
            </div>
            <div className="flex gap-2">
              {/* approve: text-emerald-100 → text-emerald-700 */}
              <button type="button" onClick={() => onStatus(index, 'Approved')} className="grid size-9 place-items-center rounded-xl bg-emerald-500/20 text-emerald-700 transition hover:bg-emerald-500/30" title="Approve"><Check className="size-4" /></button>
              {/* reject: text-rose-100 → text-rose-700 */}
              <button type="button" onClick={() => onStatus(index, 'Rejected')} className="grid size-9 place-items-center rounded-xl bg-rose-500/20 text-rose-700 transition hover:bg-rose-500/30" title="Reject"><X className="size-4" /></button>
              {/* edit: bg-white/[0.06] text-slate-200 → bg-orange-50 text-slate-600 */}
              <button type="button" className="grid size-9 place-items-center rounded-xl bg-orange-50 text-slate-600 transition hover:bg-orange-100" title="Edit"><PenLine className="size-4" /></button>
            </div>
          </div>)}
      </GlassCard>
    </div>;
}
function StatusBadge({
  status
}: {
  status: string;
}) {
  // text-*-100 → text-*-700
  const styles: Record<string, string> = {
    Approved: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-700',
    Pending: 'border-amber-300/30 bg-amber-500/15 text-amber-700',
    Rejected: 'border-rose-300/30 bg-rose-500/15 text-rose-700'
  };
  return <span className={classNames('w-fit rounded-full border px-3 py-1 text-xs font-semibold', styles[status])}>{status}</span>;
}
function AdminCms({
  t,
  form,
  setForm,
  modules,
  toggleModule,
  saveState,
  saveQuestion
}: {
  t: typeof copy.en;
  form: {
    subtest: string;
    question: string;
    answer: string;
    explanation: string;
  };
  setForm: (form: {
    subtest: string;
    question: string;
    answer: string;
    explanation: string;
  }) => void;
  modules: string[];
  toggleModule: (module: string) => void;
  saveState: 'idle' | 'saved';
  saveQuestion: () => void;
}) {
  return <div className="mx-auto grid w-full max-w-7xl gap-5 xl:grid-cols-[1fr_.9fr]">
      <GlassCard className="p-5 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-orange-700">Admin Question CMS</p>
            <h2 className="text-3xl font-semibold">Question Editor</h2>
          </div>
          {/* + button: border-white/10 bg-white/[0.06] text-slate-200 → border-orange-200 bg-orange-50 text-slate-600 */}
          <button type="button" className="grid size-11 place-items-center rounded-xl border border-orange-200 bg-orange-50 text-slate-600 transition hover:bg-orange-100">
            <Plus className="size-5" />
          </button>
        </div>
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Subtest</span>
            {/* select: border-white/10 bg-slate-950/60 → border-orange-200 bg-white text-slate-700 */}
            <select value={form.subtest} onChange={event => setForm({
            ...form,
            subtest: event.target.value
          })} className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-slate-700 outline-none focus:border-orange-400/70">
              {subtests.map(item => <option key={item.title}>{item.title}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Question content</span>
            {/* textarea: border-white/10 bg-slate-950/60 → border-orange-200 bg-white text-slate-700 */}
            <textarea value={form.question} onChange={event => setForm({
            ...form,
            question: event.target.value
          })} className="min-h-28 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-slate-700 outline-none focus:border-orange-400/70" />
          </label>
          <button type="button" className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-orange-300/50 bg-orange-600/10 px-4 py-8 text-orange-800 transition hover:bg-orange-600/15">
            <Upload className="size-5" />
            Drag & drop diagram
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            {['A', 'B', 'C', 'D'].map(letter => <button key={letter} type="button" onClick={() => setForm({
            ...form,
            answer: letter
          })} className={classNames('flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition', form.answer === letter ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-700' : 'border-orange-200 bg-white text-slate-600 hover:bg-orange-100')}>
                Option {letter}
                {form.answer === letter && <Check className="size-4" />}
              </button>)}
          </div>
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Explanation</span>
            {/* textarea: border-white/10 bg-slate-950/60 → border-orange-200 bg-white text-slate-700 */}
            <textarea value={form.explanation} onChange={event => setForm({
            ...form,
            explanation: event.target.value
          })} className="min-h-24 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-slate-700 outline-none focus:border-orange-400/70" />
          </label>
          <div className="flex flex-wrap gap-2">
            {['CS', 'Economics', 'Engineering'].map(module => <button key={module} type="button" onClick={() => toggleModule(module)} className={classNames('rounded-full border px-3 py-2 text-sm transition', modules.includes(module) ? 'border-orange-300/60 bg-orange-600/20 text-orange-800' : 'border-orange-200 bg-white text-slate-500')}>
                {modules.includes(module) ? <Lock className="mr-1 inline size-3" /> : null}
                {module}
              </button>)}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {/* discard: border-white/10 text-slate-200 hover:bg-white/[0.08] → border-orange-300 text-slate-600 hover:bg-orange-100 */}
            <button type="button" className="rounded-xl border border-orange-300 px-5 py-3 font-semibold text-slate-600 transition hover:bg-orange-100">Discard Changes</button>
            <button type="button" onClick={saveQuestion} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-500">
              <Save className="size-4" />
              {saveState === 'saved' ? 'Save Successful' : t.save}
            </button>
          </div>
        </div>
      </GlassCard>
      <GlassCard className="p-5 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Live Preview</p>
            <h3 className="text-2xl font-semibold">{form.subtest}</h3>
          </div>
          <ImagePlus className="size-6 text-orange-700" />
        </div>
        {/* live preview panel: border-white/10 bg-slate-950/50 → border-orange-200 bg-orange-50 */}
        <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
          <p className="text-sm text-slate-400">Question 1 of 20</p>
          <h4 className="mt-3 text-xl font-semibold leading-snug">{form.question}</h4>
          {/* diagram area: border-dashed border-white/15 bg-white/[0.03] → border-dashed border-orange-200 bg-orange-50 */}
          <div className="my-5 grid min-h-40 place-items-center rounded-2xl border border-dashed border-orange-200 bg-orange-50 text-slate-500">Diagram preview</div>
          <div className="grid gap-3">
            {['A', 'B', 'C', 'D'].map(letter => <div key={letter} className={classNames('rounded-2xl border px-4 py-3', form.answer === letter ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-700' : 'border-orange-200 bg-white text-slate-600')}>
                {letter}. Answer option {letter}
              </div>)}
          </div>
          <div className="mt-5 rounded-2xl border border-orange-200/60 bg-orange-600/10 p-4 text-sm text-orange-800">{form.explanation}</div>
        </div>
      </GlassCard>
    </div>;
}
