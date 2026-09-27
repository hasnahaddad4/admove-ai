'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore, useViewStore, canAccessView } from '@/stores/auth-store';
import { AuthScreen } from '@/components/auth/auth-screen';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardView } from '@/components/views/dashboard-view';
import { CampaignsView } from '@/components/views/campaigns-view';
import { VehiclesView } from '@/components/views/vehicles-view';
import { PredictionsView } from '@/components/views/predictions-view';
import { RecommendationsView } from '@/components/views/recommendations-view';
import { AnalyticsView } from '@/components/views/analytics-view';
import { ReportsView } from '@/components/views/reports-view';
import { AiModelView } from '@/components/views/ai-model-view';
import { SettingsView } from '@/components/views/settings-view';
import { UsersView } from '@/components/views/users-view';
import { TasksView } from '@/components/views/tasks-view';
import { MyTeamView } from '@/components/views/my-team-view';
import { MyTasksView } from '@/components/views/my-tasks-view';
import { MyCampaignsView } from '@/components/views/my-campaigns-view';
import { MyProfileView } from '@/components/views/my-profile-view';
import { NotificationsView } from '@/components/views/notifications-view';
import { MyActivityView } from '@/components/views/my-activity-view';
import { CompaniesView } from '@/components/views/companies-view';
import { api } from '@/lib/api';

// Dynamically import views that use Leaflet (requires window)
const TrackingView = dynamic(
  () => import('@/components/views/tracking-view').then((m) => m.TrackingView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const MapView = dynamic(
  () => import('@/components/views/map-view').then((m) => m.MapView),
  { ssr: false, loading: () => <ViewLoading /> }
);

function ViewLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, token, user, setAuth, logout } = useAuthStore();
  // checking is true only when we have a token and need to verify it
  const [checking, setChecking] = useState(() => !!token);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.auth
      .me()
      .then((res) => {
        if (!cancelled) setAuth(token, res.user);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading AdMove AI...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthScreen />;
  }

  return <DashboardShell />;
}

function DashboardShell() {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-auto scroll-thin">
          <ViewRouter />
        </main>
      </div>
    </div>
  );
}

function ViewRouter() {
  const { currentView } = useViewStore();
  const { user } = useAuthStore();

  // Role-based access control on the client side.
  // The view store is persisted, so on refresh we may have a stale view
  // the user no longer has access to (e.g. after role change). Fallback to dashboard.
  if (user && !canAccessView(user.role, currentView)) {
    return <DashboardView />;
  }

  switch (currentView) {
    case 'dashboard': return <DashboardView />;
    case 'users': return <UsersView />;
    case 'companies': return <CompaniesView />;
    case 'campaigns': return <CampaignsView />;
    case 'vehicles': return <VehiclesView />;
    case 'tracking': return <TrackingView />;
    case 'map': return <MapView />;
    case 'predictions': return <PredictionsView />;
    case 'recommendations': return <RecommendationsView />;
    case 'analytics': return <AnalyticsView />;
    case 'reports': return <ReportsView />;
    case 'ai-model': return <AiModelView />;
    case 'settings': return <SettingsView />;
    case 'my-team': return <MyTeamView />;
    case 'tasks': return <TasksView />;
    case 'my-tasks': return <MyTasksView />;
    case 'my-campaigns': return <MyCampaignsView />;
    case 'my-profile': return <MyProfileView />;
    case 'notifications': return <NotificationsView />;
    case 'my-activity': return <MyActivityView />;
    default: return <DashboardView />;
  }
}
