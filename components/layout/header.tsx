'use client';

import { useViewStore, useAuthStore, ViewKey, canAccessView } from '@/stores/auth-store';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const VIEW_TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview and key performance indicators' },
  users: { title: 'Users', subtitle: 'Manage system users and their roles' },
  companies: { title: 'Companies', subtitle: 'Manage company profiles' },
  campaigns: { title: 'Campaigns', subtitle: 'Manage advertising campaigns and assignments' },
  vehicles: { title: 'Vehicles', subtitle: 'Track and manage your advertising vehicles' },
  tracking: { title: 'Live Tracking', subtitle: 'Real-time GPS positions and route simulation' },
  map: { title: 'Geographic Map', subtitle: 'Zones, routes, and exposure heatmap' },
  predictions: { title: 'AI Predictions', subtitle: 'Exposure potential predictions from ML model' },
  recommendations: { title: 'AI Recommendations', subtitle: 'Optimal zones and time windows' },
  analytics: { title: 'Analytics', subtitle: 'Deep-dive campaign and zone analytics' },
  'ai-model': { title: 'AI Model', subtitle: 'Model metrics, feature importance, and evaluation' },
  reports: { title: 'Reports', subtitle: 'Generate and download campaign performance reports' },
  'my-team': { title: 'My Team', subtitle: 'Manage your team members and their tasks' },
  tasks: { title: 'Tasks', subtitle: 'Manage tasks and assignments' },
  'my-tasks': { title: 'My Tasks', subtitle: 'Tasks assigned to you' },
  'my-campaigns': { title: 'My Campaigns', subtitle: 'Campaigns you are involved in' },
  'my-profile': { title: 'My Profile', subtitle: 'Your account information' },
  notifications: { title: 'Notifications', subtitle: 'Your recent notifications' },
  'my-activity': { title: 'My Activity', subtitle: 'Your recent activity history' },
  settings: { title: 'Settings', subtitle: 'Account and system preferences' },
};

export function Header() {
  const { currentView, setView } = useViewStore();
  const { user } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Fallback if user tries to access a view they can't (defensive)
  const info = VIEW_TITLES[currentView] || VIEW_TITLES.dashboard;

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="text-lg font-semibold">{info.title}</h1>
        <p className="text-xs text-muted-foreground">{info.subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setView('notifications')}
          className="relative p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full px-1 py-0.5 min-w-[16px] text-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <Sparkles className="w-3 h-3 text-primary" />
          <span>Demo Mode — Simulated Data</span>
        </div>
      </div>
    </header>
  );
}
