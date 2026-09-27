import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireRole, hashPassword, UserRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  managerId: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      managerId: true,
      jobTitle: true,
      active: true,
      createdAt: true,
      manager: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true, industry: true, city: true, country: true } },
      _count: {
        select: {
          tasksAssigned: true,
          tasksCreated: true,
          teamMembers: true,
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Email uniqueness check
  if (parsed.data.email && parsed.data.email !== existing.email) {
    const emailTaken = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
  }

  // Validate manager
  if (parsed.data.managerId) {
    const manager = await db.user.findUnique({ where: { id: parsed.data.managerId } });
    if (!manager || manager.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Assigned manager must have MANAGER role' },
        { status: 400 }
      );
    }
    if (parsed.data.managerId === id) {
      return NextResponse.json({ error: 'User cannot be their own manager' }, { status: 400 });
    }
  }

  const updateData: any = { ...parsed.data };
  if (parsed.data.password) {
    updateData.passwordHash = await hashPassword(parsed.data.password);
    delete updateData.password;
  }

  const user = await db.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      managerId: true,
      jobTitle: true,
      active: true,
      updatedAt: true,
    },
  });

  await logActivity(auth.userId, 'UPDATE_USER', 'user', id, parsed.data);

  return NextResponse.json({ user });
}

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

  // Soft-delete: deactivate instead of hard delete to preserve references
  await db.user.update({
    where: { id },
    data: { active: false },
  });

  await logActivity(auth.userId, 'DEACTIVATE_USER', 'user', id, { email: existing.email });

  return NextResponse.json({ success: true, deactivated: true });
}
