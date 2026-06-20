'use client';

import { type ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, Timer,
  Users, PenLine, LogOut, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Background Gradient ---
export function KniBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_12%_12%,rgba(234,88,12,.14),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(245,158,11,.16),transparent_28%),linear-gradient(135deg,#fff7ed,#ffffff_46%,#fffbeb)]" />
  );
}

// --- Card Primitives ---
export function KniCard({
  children,
  className,
  variant = 'light',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  variant?: 'light' | 'dark';
  onClick?: () => void;
}) {
  if (variant === 'dark') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-sm',
          onClick && 'cursor-pointer hover:bg-slate-900/90 transition-all duration-300',
          className
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-orange-100/60 bg-white/80 backdrop-blur-sm',
        'transition-all duration-300 hover:border-orange-200 hover:bg-white/90',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

// --- Button Primitive ---
export function KniButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className,
  type = 'button',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-500/25',
    secondary: 'bg-white hover:bg-orange-50 text-slate-950 border border-orange-200 shadow-sm',
    outline: 'border border-orange-300/50 text-orange-800 hover:bg-orange-600/15',
    ghost: 'text-slate-600 hover:bg-orange-50 hover:text-slate-950',
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/25',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(baseStyles, variants[variant], className)}
      title={title}
    >
      {children}
    </button>
  );
}

// --- Badge Primitive ---
export function KniBadge({
  status,
  className,
}: {
  status: 'Approved' | 'Pending' | 'Rejected' | 'Easy' | 'Medium' | 'Hard' | string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    Approved: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-700',
    Pending: 'border-amber-300/30 bg-amber-500/15 text-amber-700',
    Rejected: 'border-rose-300/30 bg-rose-500/15 text-rose-700',
    Easy: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-700',
    Medium: 'border-amber-300/30 bg-amber-500/15 text-amber-700',
    Hard: 'border-rose-300/30 bg-rose-500/15 text-rose-700',
  };

  const matchedStyle = styles[status] || 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <span className={cn('w-fit rounded-full border px-3 py-1 text-xs font-semibold', matchedStyle, className)}>
      {status}
    </span>
  );
}

// --- Progress Indicator ---
export function KniProgress({
  value,
  className,
}: {
  value: number; // percentage 0-100
  className?: string;
}) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-orange-100', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// --- View type ---
export type DashboardView = 'dashboard' | 'practice' | 'mock' | 'users' | 'cms' | 'review';

type AppNavItem = {
  id: DashboardView;
  icon: typeof LayoutDashboard;
  label: string;
};

function getNavigation(isAdmin?: boolean): AppNavItem[] {
  const nav: AppNavItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'practice', icon: BookOpen, label: 'Practice' },
    { id: 'mock', icon: Timer, label: 'Mock Test' },
  ];

  if (isAdmin) {
    nav.push({ id: 'users', icon: Users, label: 'Users' });
    nav.push({ id: 'cms', icon: PenLine, label: 'CMS' });
  }

  return nav;
}

// --- Header Primitive ---
export function KniHeader({
  email,
  onLogout,
  isAdmin,
  activeView,
  onViewChange,
  isSidebarExpanded,
}: {
  email?: string;
  onLogout?: () => void;
  isAdmin?: boolean;
  activeView?: DashboardView;
  onViewChange?: (view: DashboardView) => void;
  isSidebarExpanded?: boolean;
}) {
  const router = useRouter();
  const nav = getNavigation(isAdmin);

  const handleNav = (item: AppNavItem) => {
    if (onViewChange) {
      onViewChange(item.id);
    } else if (item.id === 'dashboard') {
      router.push('/dashboard');
    }
  };

  return (
    <header className="relative z-10 flex items-center justify-between border-b border-orange-100/70 bg-white/70 px-4 py-3.5 backdrop-blur-xl md:px-6">
      {/* Site title */}
      <div
        onClick={() => handleNav({ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' })}
        className="flex min-w-0 items-center gap-3 cursor-pointer select-none"
      >
        <div className="hidden text-left sm:block">
          <p className="text-xs text-slate-400">mocktest.kni.vn</p>
          <h1 className="truncate text-base font-semibold text-slate-900 leading-tight">TestAS Prep Platform</h1>
        </div>
      </div>

      {/* Center text nav — only on lg+ when sidebar is collapsed (icon-only mode) */}
      {!isSidebarExpanded && (
        <nav className="mx-4 hidden flex-1 justify-center gap-1 lg:flex" aria-label="Primary navigation">
          {nav.map(item => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                    : 'text-slate-600 hover:bg-orange-50 hover:text-slate-950'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Right side */}
      <div className="flex items-center gap-3 ml-auto">
        {email && (
          <div className="hidden lg:block text-right">
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="text-xs font-semibold text-slate-700">{email}</p>
          </div>
        )}
        {/* Mobile logout — sidebar handles it on md+ */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="grid size-9 place-items-center rounded-full border border-orange-200 bg-white/80 text-slate-600 hover:bg-orange-50 hover:text-slate-950 shadow-sm md:hidden"
            title="Log Out"
          >
            <LogOut className="size-4" />
          </button>
        )}
      </div>
    </header>
  );
}


// --- Sidebar Primitive ---
export function KniSidebar({
  onLogout,
  isAdmin,
  activeView,
  onViewChange,
  isExpanded,
  onToggleExpand,
}: {
  onLogout?: () => void;
  isAdmin?: boolean;
  activeView?: DashboardView;
  onViewChange?: (view: DashboardView) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const router = useRouter();
  const nav = getNavigation(isAdmin);

  const handleNav = (item: AppNavItem) => {
    if (onViewChange) {
      onViewChange(item.id);
    } else if (item.id === 'dashboard') {
      router.push('/dashboard');
    }
  };

  return (
    <aside
      className={cn(
        // Always shown on md+, hidden on mobile
        'hidden md:flex shrink-0 flex-col border-r border-orange-100/60 bg-white/80 backdrop-blur-xl shadow-sm',
        'transition-[width] duration-300 ease-in-out overflow-hidden',
        // Collapsed = narrow icon strip; Expanded = full text sidebar (lg+ only)
        isExpanded ? 'lg:w-56 w-[72px]' : 'w-[72px]',
        'py-5 px-3',
      )}
    >
      {/* ── Logo row ─────────────────────────────── */}
      <div
        className={cn(
          'flex items-center mb-6 min-w-0 transition-all duration-300',
          isExpanded ? 'lg:px-1 lg:gap-3 px-1.5 gap-0' : 'px-1.5 gap-0'
        )}
      >
        <div className="size-9 shrink-0 overflow-hidden rounded-xl bg-white shadow-md shadow-orange-500/10 border border-orange-100/50">
          <img src="/logo.webp" alt="KNI Logo" className="w-full h-full object-cover" />
        </div>
        <span
          className={cn(
            'font-bold text-base text-slate-800 tracking-wide whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out',
            isExpanded ? 'lg:max-w-40 lg:opacity-100' : 'max-w-0 opacity-0',
          )}
        >
          KNI TestAS
        </span>
      </div>

      {/* ── Nav items ────────────────────────────── */}
      <nav className="flex flex-col gap-1 flex-1">
        {nav.map(item => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={isExpanded ? undefined : item.label}
              onClick={() => handleNav(item)}
              className={cn(
                'flex items-center w-full h-10 rounded-xl transition-all duration-200 text-left',
                isActive
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md shadow-orange-600/15 font-semibold'
                  : 'text-slate-500 hover:bg-orange-50 hover:text-slate-900',
                isExpanded ? 'lg:px-3 lg:gap-3 px-[15px] gap-0' : 'px-[15px] gap-0'
              )}
            >
              <item.icon className="size-[18px] shrink-0" />
              <span
                className={cn(
                  'text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out',
                  isExpanded ? 'lg:max-w-40 lg:opacity-100' : 'max-w-0 opacity-0',
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Bottom: logout + collapse toggle ─────── */}
      <div className="flex flex-col gap-1 mt-4 pt-4 border-t border-orange-100/60">
        {onLogout && (
          <button
            type="button"
            title="Log out"
            onClick={onLogout}
            className={cn(
              'flex items-center w-full h-10 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 text-left',
              isExpanded ? 'lg:px-3 lg:gap-3 px-[15px] gap-0' : 'px-[15px] gap-0'
            )}
          >
            <LogOut className="size-[18px] shrink-0" />
            <span
              className={cn(
                'text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out',
                isExpanded ? 'lg:max-w-40 lg:opacity-100' : 'max-w-0 opacity-0',
              )}
            >
              Log out
            </span>
          </button>
        )}

        {/* Collapse/expand toggle — lg+ only */}
        {onToggleExpand && (
          <button
            type="button"
            title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={onToggleExpand}
            className={cn(
              'hidden lg:flex items-center w-full h-10 rounded-xl text-slate-400 hover:bg-orange-50 hover:text-slate-700 transition-all duration-200 text-left',
              isExpanded ? 'px-3 gap-3' : 'px-[15px] gap-0'
            )}
          >
            {isExpanded
              ? <PanelLeftClose className="size-[18px] shrink-0" />
              : <PanelLeftOpen  className="size-[18px] shrink-0" />
            }
            <span
              className={cn(
                'text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out',
                isExpanded ? 'lg:max-w-40 lg:opacity-100' : 'max-w-0 opacity-0',
              )}
            >
              Collapse
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}


function KniMobileNav({
  isAdmin,
  activeView,
  onViewChange,
}: {
  isAdmin?: boolean;
  activeView: DashboardView;
  onViewChange?: (view: DashboardView) => void;
}) {
  const nav = getNavigation(isAdmin);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-orange-100 bg-white/95 p-2 shadow-2xl shadow-slate-300/60 backdrop-blur-xl md:hidden"
    >
      {nav.map(item => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            title={item.label}
            onClick={() => onViewChange?.(item.id)}
            className={cn(
              'grid size-11 place-items-center rounded-xl transition-all duration-200',
              isActive
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/25'
                : 'text-slate-500 hover:bg-orange-50 hover:text-slate-950'
            )}
          >
            <item.icon className="size-5" />
          </button>
        );
      })}
    </nav>
  );
}

// --- Layout Shell ---
export function KniShell({
  children,
  email,
  onLogout,
  isAdmin,
  activeView = 'dashboard',
  onViewChange,
}: {
  children: ReactNode;
  email?: string;
  major?: string;
  onLogout?: () => void;
  isAdmin?: boolean;
  activeView?: DashboardView;
  onViewChange?: (view: DashboardView) => void;
}) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Persist expand state across reloads
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kni-sidebar-expanded');
      if (stored !== null) setSidebarExpanded(stored === 'true');
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem('kni-sidebar-expanded', String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-orange-50 text-slate-950 flex flex-col relative">
      <KniBackground />
      <div className="relative flex flex-1 min-h-0">
        <KniSidebar
          onLogout={onLogout}
          isAdmin={isAdmin}
          activeView={activeView}
          onViewChange={onViewChange}
          isExpanded={sidebarExpanded}
          onToggleExpand={toggleSidebar}
        />
        <section className="flex flex-col flex-1 min-w-0 min-h-0">
          <KniHeader
            email={email}
            onLogout={onLogout}
            isAdmin={isAdmin}
            activeView={activeView}
            onViewChange={onViewChange}
            isSidebarExpanded={sidebarExpanded}
          />
          <main className="relative z-10 flex-1 overflow-y-auto p-4 pb-20 md:p-5 md:pb-5">
            {children}
          </main>
        </section>
      </div>
      <KniMobileNav isAdmin={isAdmin} activeView={activeView} onViewChange={onViewChange} />
    </div>
  );
}
