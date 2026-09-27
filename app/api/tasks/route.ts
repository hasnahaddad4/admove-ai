import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthFromRequest, requireRole } from '@/lib/auth';
import { logActivity, notify } from '@/lib/activity';

const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  assignedToId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const assignedToId = searchParams.get('assignedToId');
  const campaignId = searchParams.get('campaignId');
  const mine = searchParams.get('mine');

  const where: any = {};

  // Role-based filtering
  if (auth.role === 'EMPLOYEE') {
    // Employees only see tasks assigned to them
    where.assignedToId = auth.userId;
  } else if (auth.role === 'MANAGER') {
    // Managers see tasks they created OR tasks assigned to their team members
    if (mine === 'true') {
      where.assignedToId = auth.userId;
    } else {
      where.OR = [
        { assignedById: auth.userId },
        { assignedTo: { managerId: auth.userId } },
        { assignedToId: auth.userId },
      ];
    }
  }
  // ADMIN sees all tasks

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignedToId) where.assignedToId = assignedToId;
  if (campaignId) where.campaignId = campaignId;

  const tasks = await db.task.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      assignedBy: { select: { id: true, name: true, email: true, role: true } },
      campaign: { select: { id: true, name: true, status: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'MANAGER', 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, priority, assignedToId, campaignId, dueDate } = parsed.data;

    // Validate assignee if provided
    if (assignedToId) {
      const assignee = await db.user.findUnique({ where: { id: assignedToId } });
      if (!assignee) {
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 400 });
      }
      if (!assignee.active) {
        return NextResponse.json({ error: 'Assigned user is not active' }, { status: 400 });
      }
      // Managers can only assign to their team members or themselves
      if (auth.role === 'MANAGER' && assignee.role !== 'MANAGER') {
        if (assignee.managerId !== auth.userId) {
          return NextResponse.json(
            { error: 'You can only assign tasks to your team members' },
            { status: 403 }
          );
        }
      }
    }

    if (campaignId) {
      const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 400 });
      }
    }

    const task = await db.task.create({
      data: {
        title,
        description: description || null,
        priority,
        assignedToId: assignedToId || null,
        assignedById: auth.userId,
        campaignId: campaignId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
      },
    });

    await logActivity(auth.userId, 'CREATE_TASK', 'task', task.id, { title });

    // Notify assignee
    if (assignedToId) {
      await notify(
        assignedToId,
        'New task assigned',
        `You have been assigned: "${title}"`,
        'TASK',
        'my-tasks'
      );
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Task POST error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
