import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, signToken, getAuthFromRequest } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional().default('EMPLOYEE'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Get or create a default company for new users
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
      data: { name, email, passwordHash, role, companyId: company.id },
    });

    // Log activity if authenticated (admin creating user)
    const auth = getAuthFromRequest(request);
    if (auth) {
      await logActivity(auth.userId, 'CREATE_USER', 'user', user.id, { email, role });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      companyId: user.companyId,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
