import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');

  const where: any = { userId: auth.userId };
  if (unreadOnly) where.read = false;

  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });

  const unreadCount = await db.notification.count({
    where: { userId: auth.userId, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

// Mark all as read
export async function PUT(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await db.notification.updateMany({
    where: { userId: auth.userId, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
