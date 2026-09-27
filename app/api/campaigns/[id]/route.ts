import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthFromRequest, requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  product: z.string().min(1).optional(),
  targetAudience: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().min(0).optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'PAUSED']).optional(),
  vehicleIds: z.array(z.string()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const campaign = await db.campaign.findUnique({
      where: { id },
      include: {
        company: true,
        vehicles: { include: { vehicle: true } },
        exposures: {
          include: { zone: true },
          orderBy: { date: 'desc' },
          take: 500,
        },
        recommendations: {
          include: { zone: true },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Compute analytics
    const totalDistance = await db.gpsPoint.aggregate({
      where: { campaignId: id },
      _sum: { distanceFromPreviousPoint: true },
    });

    const avgExposure = await db.exposureRecord.aggregate({
      where: { campaignId: id },
      _avg: { exposureScore: true },
    });

    const topZones = await db.exposureRecord.groupBy({
      by: ['zoneId'],
      where: { campaignId: id },
      _avg: { exposureScore: true },
      _count: true,
      orderBy: { _avg: { exposureScore: 'desc' } },
      take: 5,
    });

    const zonesWithNames = await Promise.all(
      topZones.map(async (z) => {
        const zone = await db.zone.findUnique({ where: { id: z.zoneId } });
        return {
          zoneId: z.zoneId,
          zoneName: zone?.name,
          avgScore: z._avg.exposureScore,
          count: z._count,
        };
      })
    );

    const topHours = await db.exposureRecord.groupBy({
      by: ['hour'],
      where: { campaignId: id },
      _avg: { exposureScore: true },
      orderBy: { _avg: { exposureScore: 'desc' } },
      take: 5,
    });

    return NextResponse.json({
      campaign,
      analytics: {
        totalDistance: totalDistance._sum.distanceFromPreviousPoint || 0,
        avgExposure: avgExposure._avg.exposureScore || 0,
        topZones: zonesWithNames,
        topHours: topHours.map((h) => ({
          hour: h.hour,
          avgScore: h._avg.exposureScore,
        })),
      },
    });
  } catch (error) {
    console.error('Campaign GET by ID error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'ADMIN', 'MANAGER');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const { vehicleIds, startDate, endDate, ...data } = parsed.data;

    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e <= s) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
      }
    }

    const updateData: any = { ...data };
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);

    // Use a transaction to ensure vehicle reassignment + campaign update are atomic
    const campaign = await db.$transaction(async (tx) => {
      if (vehicleIds !== undefined) {
        await tx.campaignVehicle.deleteMany({ where: { campaignId: id } });
        if (vehicleIds.length > 0) {
          await tx.campaignVehicle.createMany({
            data: vehicleIds.map((vid) => ({ campaignId: id, vehicleId: vid })),
          });
        }
      }
      return tx.campaign.update({
        where: { id },
        data: updateData,
        include: { vehicles: { include: { vehicle: true } } },
      });
    });

    await logActivity(auth.userId, 'UPDATE_CAMPAIGN', 'campaign', id, parsed.data);

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Campaign PUT error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'ADMIN', 'MANAGER');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    await db.campaign.delete({ where: { id } });
    await logActivity(auth.userId, 'DELETE_CAMPAIGN', 'campaign', id, { name: existing.name });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Campaign DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
