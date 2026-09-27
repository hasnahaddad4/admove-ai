import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  managerId?: string | null;
  jobTitle?: string | null;
  active?: boolean;
  company?: {
    id: string;
    name: string;
    industry: string;
    address?: string;
    city: string;
    country: string;
  } | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      updateUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    { name: 'admove-auth' }
  )
);

// Role-specific view keys
export type ViewKey =
  // shared
  | 'dashboard'
  // admin
  | 'users'
  | 'companies'
  // management
  | 'campaigns'
  | 'vehicles'
  | 'tracking'
  | 'map'
  // ai
  | 'predictions'
  | 'recommendations'
  | 'ai-model'
  // analytics & output
  | 'analytics'
  | 'reports'
  // manager
  | 'my-team'
  | 'tasks'
  // employee
  | 'my-tasks'
  | 'my-campaigns'
  | 'my-profile'
  | 'notifications'
  | 'my-activity'
  // settings
  | 'settings';

interface ViewState {
  currentView: ViewKey;
  selectedCampaignId: string | null;
  selectedVehicleId: string | null;
  selectedTaskId: string | null;
  setView: (view: ViewKey) => void;
  selectCampaign: (id: string | null) => void;
  selectVehicle: (id: string | null) => void;
  selectTask: (id: string | null) => void;
}

export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
      currentView: 'dashboard',
      selectedCampaignId: null,
      selectedVehicleId: null,
      selectedTaskId: null,
      setView: (view) => set({ currentView: view }),
      selectCampaign: (id) => set({ selectedCampaignId: id, currentView: 'campaigns' }),
      selectVehicle: (id) => set({ selectedVehicleId: id, currentView: 'vehicles' }),
      selectTask: (id) => set({ selectedTaskId: id, currentView: 'tasks' }),
    }),
    { name: 'admove-view' }
  )
);

// Role-based navigation config
export interface NavItem {
  key: ViewKey;
  label: string;
  icon: string; // lucide icon name
  group: string;
}

export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', group: 'Overview' },
    { key: 'users', label: 'Users', icon: 'Users', group: 'Administration' },
    { key: 'companies', label: 'Companies', icon: 'Building2', group: 'Administration' },
    { key: 'campaigns', label: 'Campaigns', icon: 'Megaphone', group: 'Management' },
    { key: 'vehicles', label: 'Vehicles', icon: 'Truck', group: 'Management' },
    { key: 'tracking', label: 'Live Tracking', icon: 'Radio', group: 'Management' },
    { key: 'map', label: 'Map', icon: 'Map', group: 'Geographic' },
    { key: 'analytics', label: 'Analytics', icon: 'BarChart3', group: 'Geographic' },
    { key: 'predictions', label: 'AI Predictions', icon: 'Brain', group: 'AI Engine' },
    { key: 'recommendations', label: 'Recommendations', icon: 'Lightbulb', group: 'AI Engine' },
    { key: 'ai-model', label: 'AI Model', icon: 'Cpu', group: 'AI Engine' },
    { key: 'reports', label: 'Reports', icon: 'FileText', group: 'Output' },
    { key: 'settings', label: 'Settings', icon: 'Settings', group: 'Output' },
  ],
  MANAGER: [
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', group: 'Overview' },
    { key: 'my-team', label: 'My Team', icon: 'Users', group: 'Team' },
    { key: 'tasks', label: 'Tasks', icon: 'CheckSquare', group: 'Team' },
    { key: 'campaigns', label: 'Campaigns', icon: 'Megaphone', group: 'Management' },
    { key: 'vehicles', label: 'Vehicles', icon: 'Truck', group: 'Management' },
    { key: 'tracking', label: 'Live Tracking', icon: 'Radio', group: 'Management' },
    { key: 'predictions', label: 'AI Predictions', icon: 'Brain', group: 'AI Engine' },
    { key: 'recommendations', label: 'Recommendations', icon: 'Lightbulb', group: 'AI Engine' },
    { key: 'analytics', label: 'Analytics', icon: 'BarChart3', group: 'Geographic' },
    { key: 'reports', label: 'Reports', icon: 'FileText', group: 'Output' },
  ],
  EMPLOYEE: [
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', group: 'Overview' },
    { key: 'my-tasks', label: 'My Tasks', icon: 'CheckSquare', group: 'My Work' },
    { key: 'my-campaigns', label: 'My Campaigns', icon: 'Megaphone', group: 'My Work' },
    { key: 'notifications', label: 'Notifications', icon: 'Bell', group: 'My Work' },
    { key: 'my-activity', label: 'My Activity', icon: 'Activity', group: 'My Work' },
    { key: 'my-profile', label: 'My Profile', icon: 'UserCircle', group: 'Account' },
  ],
};

// Helper to determine if a role can access a view
export function canAccessView(role: UserRole, view: ViewKey): boolean {
  const allowed = ROLE_NAV[role].map((n) => n.key);
  return allowed.includes(view);
}
