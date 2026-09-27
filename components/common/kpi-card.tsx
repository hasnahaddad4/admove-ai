'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: number;
  accent?: 'primary' | 'green' | 'amber' | 'purple';
}

const ACCENT_CLASSES = {
  primary: 'bg-primary/10 text-primary',
  green: 'bg-emerald-500/10 text-emerald-600',
  amber: 'bg-amber-500/10 text-amber-600',
  purple: 'bg-purple-500/10 text-purple-600',
};

export function KpiCard({ label, value, unit, icon: Icon, trend, accent = 'primary' }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', ACCENT_CLASSES[accent])}>
            <Icon className="w-5 h-5" />
          </div>
          {trend !== undefined && (
            <span className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              trend >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
            )}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">
            {value}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
