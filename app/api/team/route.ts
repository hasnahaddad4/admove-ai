import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest, requireRole } from '@/lib/auth';

// Get manager's team members
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'MANAGER', 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope'); // if 'all', admin can see all users

  let where: any = {};
  if (auth.role === 'MANAGER') {
    where.managerId = auth.userId;
  } else if (auth.role === 'ADMIN' && scope !== 'all') {
    // Admin with no scope returns all employees
    where.role = 'EMPLOYEE';
  }

  const members = await db.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      active: true,
      createdAt: true,
      _count: {
        select: {
          tasksAssigned: true,
          tasksCreated: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Add task stats per member
  const membersWithStats = await Promise.all(
    members.map(async (m) => {
      const taskStats = await db.task.groupBy({
        by: ['status'],
        where: { assignedToId: m.id },
        _count: true,
      });
      const stats: Record<string, number> = {
        TODO: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        CANCELLED: 0,
      };
      taskStats.forEach((t) => (stats[t.status] = t._count));
      return { ...m, taskStats: stats };
    })
  );

  return NextResponse.json({ members: membersWithStats });
}
