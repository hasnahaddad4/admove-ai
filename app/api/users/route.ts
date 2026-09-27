import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireRole, hashPassword, UserRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  managerId: z.string().nullable().optional(),
  jobTitle: z.string().optional(),
  active: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const users = await db.user.findMany({
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
        manager: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        _count: {
          select: {
            tasksAssigned: true,
            teamMembers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'ADMIN');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, role, managerId, jobTitle, active } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    // Validate managerId — must be a MANAGER
    if (managerId) {
      const manager = await db.user.findUnique({ where: { id: managerId } });
      if (!manager || manager.role !== 'MANAGER') {
        return NextResponse.json(
          { error: 'Assigned manager must be a user with MANAGER role' },
          { status: 400 }
        );
      }
    }

    let company = await db.company.findFirst();
    if (!company) {
      company = await db.company.create({
        data: {
          name: 'AdMove Mobility Group',
          industry: 'Mobile Advertising',
          address: 'Les Berges du Lac 2',
          city: 'Tunis',
          country: 'Tunisia',
        },
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        managerId: managerId || null,
        jobTitle: jobTitle || null,
        active,
        companyId: company.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        jobTitle: true,
        active: true,
        createdAt: true,
      },
    });

    await logActivity(auth.userId, 'CREATE_USER', 'user', user.id, { email, role });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('User POST error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
