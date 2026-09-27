'use client';

import {
  LayoutDashboard, Megaphone, Truck, Radio, Map, Brain,
  Lightbulb, BarChart3, FileText, Cpu, Settings, LogOut,
  Users, Building2, CheckSquare, Bell, Activity, UserCircle,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, useViewStore, ViewKey, NavItem, ROLE_NAV } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Megaphone, Truck, Radio, Map, Brain,
  Lightbulb, BarChart3, FileText, Cpu, Settings,
  Users, Building2, CheckSquare, Bell, Activity, UserCircle,
};

export function Sidebar() {
  const { currentView, setView } = useViewStore();
  const { user, logout } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count for badge
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchUnread = () => {
      api.notifications.list(true).then((res) => {
        if (!cancelled) setUnreadCount(res.unreadCount || 0);
      }).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  if (!user) return null;

  const navItems: NavItem[] = ROLE_NAV[user.role] || [];
  const groups = [...new Set(navItems.map((i) => i.group))];

  const roleLabel = user.role === 'ADMIN' ? 'Administrator' : user.role === 'MANAGER' ? 'Manager' : 'Employee';

  return (
    <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight">ADM0VE AI</div>
            <div className="text-[10px] text-sidebar-foreground/50">{roleLabel} Workspace</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-5">
        {groups.map((group) => (
          <div key={group}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3 mb-1.5">
              {group}
            </div>
            <div className="space-y-0.5">
              {navItems.filter((i) => i.group === group).map((item) => {
                const active = currentView === item.key;
                const Icon = ICONS[item.icon] || LayoutDashboard;
                const showBadge = item.key === 'notifications' && unreadCount > 0;
                return (
                  <button
                    key={item.key}
                    onClick={() => setView(item.key)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {showBadge && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground">
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-[10px] text-sidebar-foreground/50">
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">{user.role}</Badge>
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={logout}>
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
