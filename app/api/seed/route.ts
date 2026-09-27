import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    return NextResponse.json({
      error: 'Seeding must be run from CLI: bun run src/lib/seed.ts',
      note: 'This endpoint is disabled for safety. Use the CLI command to seed the database.',
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
