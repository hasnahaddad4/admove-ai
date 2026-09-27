import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (id === auth.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Hard delete — will cascade-delete notifications, activityLogs, taskComments.
  // Tasks have SetNull on assignee/creator, so they remain.
  await db.user.delete({ where: { id } });

  await logActivity(auth.userId, 'DELETE_USER', 'user', id, { email: existing.email });

  return NextResponse.json({ success: true });
}
