import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const task = await db.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // RBAC: employee must be the assignee
  if (auth.role === 'EMPLOYEE' && task.assignedToId !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const comments = await db.taskComment.findMany({
    where: { taskId: id },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // RBAC: employee can comment only on their own tasks
  if (auth.role === 'EMPLOYEE' && task.assignedToId !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Manager must be creator or team manager
  if (auth.role === 'MANAGER') {
    const isAssignee = task.assignedToId === auth.userId;
    const isCreator = task.assignedById === auth.userId;
    let isTeamMember = false;
    if (task.assignedToId) {
      const a = await db.user.findUnique({ where: { id: task.assignedToId } });
      isTeamMember = a?.managerId === auth.userId;
    }
    if (!isAssignee && !isCreator && !isTeamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const comment = await db.taskComment.create({
    data: {
      taskId: id,
      userId: auth.userId,
      content: parsed.data.content,
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  await logActivity(auth.userId, 'COMMENT_TASK', 'task', id, {});

  return NextResponse.json({ comment }, { status: 201 });
}
