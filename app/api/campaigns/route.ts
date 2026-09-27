import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthFromRequest, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const createCampaignSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  product: z.string().min(1),
  targetAudience: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().min(0),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'PAUSED']).optional().default('PLANNED'),
  vehicleIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaigns = await db.campaign.findMany({
      where: { companyId: auth.companyId || undefined },
      include: {
        vehicles: { include: { vehicle: true } },
        _count: { select: { exposures: true, predictions: true, recommendations: true, tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Campaigns GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'ADMIN', 'MANAGER');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { vehicleIds, startDate, endDate, ...data } = parsed.data;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.create({
      data: {
        ...data,
        startDate: start,
        endDate: end,
        companyId: auth.companyId!,
        vehicles: vehicleIds?.length
          ? { create: vehicleIds.map((vid) => ({ vehicleId: vid })) }
          : undefined,
      },
      include: { vehicles: { include: { vehicle: true } } },
    });

    await logActivity(auth.userId, 'CREATE_CAMPAIGN', 'campaign', campaign.id, { name: campaign.name });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error('Campaign POST error:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
