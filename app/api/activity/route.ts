import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const scope = searchParams.get('scope') || 'me'; // 'me' | 'all'

  let where: any = {};
  if (scope === 'me' || auth.role === 'EMPLOYEE') {
    // Employees only see their own activity
    where.userId = auth.userId;
  } else if (auth.role === 'MANAGER') {
    // Managers see their own + their team's activity
    where.OR = [
      { userId: auth.userId },
      { user: { managerId: auth.userId } },
    ];
  }
  // ADMIN sees all

  const logs = await db.activityLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500),
  });

  return NextResponse.json({ logs });
}
