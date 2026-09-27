import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';
import { logActivity, notify } from '@/lib/activity';

const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      assignedBy: { select: { id: true, name: true, email: true, role: true } },
      campaign: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
      comments: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // RBAC: employee can only view tasks assigned to them
  if (auth.role === 'EMPLOYEE' && task.assignedToId !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Manager can view tasks they created or assigned to their team
  if (auth.role === 'MANAGER') {
    const isAssignee = task.assignedToId === auth.userId;
    const isCreator = task.assignedById === auth.userId;
    let isTeamMember = false;
    if (task.assignedToId) {
      const assignee = await db.user.findUnique({ where: { id: task.assignedToId } });
      isTeamMember = assignee?.managerId === auth.userId;
    }
    if (!isAssignee && !isCreator && !isTeamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return NextResponse.json({ task });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // RBAC for update
  const isAssignee = existing.assignedToId === auth.userId;
  const isCreator = existing.assignedById === auth.userId;
  let isTeamMember = false;
  if (existing.assignedToId) {
    const assignee = await db.user.findUnique({ where: { id: existing.assignedToId } });
    isTeamMember = assignee?.managerId === auth.userId;
  }

  // Employees can only update status of their own tasks
  if (auth.role === 'EMPLOYEE') {
    if (!isAssignee) {
      return NextResponse.json({ error: 'You can only update tasks assigned to you' }, { status: 403 });
    }
    // Employees can only change status, not other fields
    const allowedFields = ['status'];
    const providedFields = Object.keys(parsed.data);
    const disallowed = providedFields.filter((f) => !allowedFields.includes(f));
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: `Employees can only update task status. Not allowed: ${disallowed.join(', ')}` },
        { status: 403 }
      );
    }
  } else if (auth.role === 'MANAGER') {
    if (!isAssignee && !isCreator && !isTeamMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const updateData: any = { ...parsed.data };
  if (parsed.data.dueDate) {
    updateData.dueDate = new Date(parsed.data.dueDate);
  }
  if (parsed.data.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
    updateData.completedAt = new Date();
  }
  if (parsed.data.status && parsed.data.status !== 'COMPLETED') {
    updateData.completedAt = null;
  }

  const task = await db.task.update({
    where: { id },
    data: updateData,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
    },
  });

  await logActivity(auth.userId, 'UPDATE_TASK', 'task', id, parsed.data);

  // Notify the creator when assignee completes the task
  if (
    parsed.data.status === 'COMPLETED' &&
    existing.status !== 'COMPLETED' &&
    existing.assignedById &&
    existing.assignedById !== auth.userId
  ) {
    await notify(
      existing.assignedById,
      'Task completed',
      `"${existing.title}" was marked as completed by ${auth.email}`,
      'TASK',
      'tasks'
    );
  }

  return NextResponse.json({ task });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Only creator or admin can delete
  if (auth.role !== 'ADMIN' && existing.assignedById !== auth.userId) {
    return NextResponse.json(
      { error: 'Only the task creator or admin can delete tasks' },
      { status: 403 }
    );
  }

  await db.task.delete({ where: { id } });
  await logActivity(auth.userId, 'DELETE_TASK', 'task', id, { title: existing.title });

  return NextResponse.json({ success: true });
}
