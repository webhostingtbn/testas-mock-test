'use client';

import { type ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BookOpen,
  LayoutDashboard,
  LogOut,
  PenLine,
  Timer,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function KniBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-kni-canvas">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(234,88,12,.08),transparent_28%),radial-gradient(circle_at_88%_4%,rgba(15,23,42,.06),transparent_26%)]" />
    </div>
  );
}

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
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-[22px] border transition duration-200',
        variant === 'dark'
          ? 'border-white/10 bg-kni-ink text-white'
          : 'border-slate-100 bg-white shadow-sm',
        onClick && (
          variant === 'dark'
            ? 'cursor-pointer hover:border-white/20 hover:bg-slate-900'
            : 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md'
        ),
        className,
      )}
    >
      {children}
    </div>
  );
}

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
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    primary: 'bg-kni-ink text-white shadow-sm hover:bg-orange-600',
    secondary: 'border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-slate-300 hover:bg-slate-50',
    outline: 'border border-slate-300 bg-transparent text-slate-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-500',
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

export function KniBadge({
  status,
  className,
}: {
  status: 'Approved' | 'Pending' | 'Rejected' | 'Easy' | 'Medium' | 'Hard' | string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Pending: 'border-amber-200 bg-amber-50 text-amber-700',
    Rejected: 'border-rose-200 bg-rose-50 text-rose-700',
    Easy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Medium: 'border-amber-200 bg-amber-50 text-amber-700',
    Hard: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <span className={cn(
      'w-fit rounded-full border px-3 py-1 text-xs font-semibold',
      styles[status] || 'border-slate-200 bg-slate-50 text-slate-600',
      className,
    )}>
      {status}
    </span>
  );
}

export function KniProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className="h-full rounded-full bg-orange-600 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export type DashboardView = 'dashboard' | 'practice' | 'mock' | 'users' | 'cms' | 'review';

type AppNavItem = {
  id: DashboardView;
  icon: typeof LayoutDashboard;
  label: string;
};

const VIEW_LABELS: Record<DashboardView, string> = {
  dashboard: 'Dashboard',
  practice: 'Practice',
  mock: 'Mock Test',
  users: 'Users',
  cms: 'Content Management',
  review: 'Attempt Review',
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

function accountInitial(email?: string) {
  return email?.trim().charAt(0).toUpperCase() || 'S';
}

export function KniHeader({
  email,
  avatarUrl,
  onLogout,
  activeView = 'dashboard',
  onViewChange,
}: {
  email?: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
  isAdmin?: boolean;
  activeView?: DashboardView;
  onViewChange?: (view: DashboardView) => void;
  isSidebarExpanded?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const goHome = () => {
    if (onViewChange) onViewChange('dashboard');
    else router.push('/dashboard');
  };

  return (
    <header className="relative z-20 flex min-h-20 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 md:px-8">
      <button type="button" onClick={goHome} className="min-w-0 text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">
          TestAS Preparation
        </p>
        <h1 className="mt-1 truncate text-lg font-black tracking-tight text-slate-950">
          {VIEW_LABELS[activeView]}
        </h1>
      </button>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          className="relative hidden size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 sm:grid"
        >
          <Bell className="size-5" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-orange-600 ring-2 ring-white" />
        </button>

        {email && (
          <div className="hidden text-right lg:block">
            <p className="max-w-56 truncate text-xs font-bold text-slate-800">{email}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Student account
            </p>
          </div>
        )}

        {avatarUrl && !imageError ? (
          <img
            src={avatarUrl}
            alt={email || 'Profile'}
            onError={() => setImageError(true)}
            className="size-10 rounded-full object-cover border border-slate-100 shadow-sm"
          />
        ) : (
          <div className="grid size-10 place-items-center rounded-full bg-kni-ink text-sm font-black text-white">
            {accountInitial(email)}
          </div>
        )}

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 md:hidden"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="size-4.5" />
          </button>
        )}
      </div>
    </header>
  );
}

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
        <button
          type="button"
          onClick={() => handleNav(nav[0])}
          className="size-9 shrink-0 overflow-hidden rounded-full shadow-md shadow-orange-500/10 border border-orange-100/50 cursor-pointer"
        >
          <img src="/logo.webp" alt="KNI Logo" className="w-full h-full object-cover" />
        </button>
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

export function KniShell({
  children,
  email,
  avatarUrl,
  onLogout,
  isAdmin,
  activeView = 'dashboard',
  onViewChange,
}: {
  children: ReactNode;
  email?: string;
  avatarUrl?: string | null;
  major?: string;
  onLogout?: () => void;
  isAdmin?: boolean;
  activeView?: DashboardView;
  onViewChange?: (view: DashboardView) => void;
}) {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('kni-sidebar-expanded');
        if (stored !== null) return stored === 'true';
      } catch {}
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('kni-sidebar-expanded', String(next));
      } catch {}
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
            avatarUrl={avatarUrl}
            onLogout={onLogout}
            isAdmin={isAdmin}
            activeView={activeView}
            onViewChange={onViewChange}
            isSidebarExpanded={sidebarExpanded}
          />
          <main className="relative z-10 flex-1 overflow-y-auto bg-[#fbfaf8] p-5 pb-24 md:p-7 md:pb-7 xl:p-8">
            {children}
          </main>
        </section>
      </div>
      <KniMobileNav isAdmin={isAdmin} activeView={activeView} onViewChange={onViewChange} />
    </div>
  );
}
