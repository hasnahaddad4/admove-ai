import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (auth.role === 'ADMIN') {
    return adminDashboard(auth);
  } else if (auth.role === 'MANAGER') {
    return managerDashboard(auth);
  } else {
    return employeeDashboard(auth);
  }
}

async function adminDashboard(auth: any) {
  const totalUsers = await db.user.count();
  const activeUsers = await db.user.count({ where: { active: true } });
  const totalEmployees = await db.user.count({ where: { role: 'EMPLOYEE' } });
  const totalManagers = await db.user.count({ where: { role: 'MANAGER' } });
  const totalAdmins = await db.user.count({ where: { role: 'ADMIN' } });

  const activeCampaigns = await db.campaign.count({ where: { status: 'ACTIVE' } });
  const totalCampaigns = await db.campaign.count();
  const totalVehicles = await db.vehicle.count();
  const activeVehicles = await db.vehicle.count({ where: { status: 'ACTIVE' } });
  const totalCompanies = await db.company.count();
  const totalZones = await db.zone.count();
  const totalTasks = await db.task.count();

  // Recent activity
  const recentActivity = await db.activityLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  // Recent users
  const recentUsers = await db.user.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  // Global analytics
  const avgExposure = await db.exposureRecord.aggregate({
    _avg: { exposureScore: true },
  });
  const totalDistance = await db.gpsPoint.aggregate({
    _sum: { distanceFromPreviousPoint: true },
  });

  // Campaign status distribution
  const campaignStatus = await db.campaign.groupBy({
    by: ['status'],
    _count: true,
  });

  // Tasks by status
  const taskStatus = await db.task.groupBy({
    by: ['status'],
    _count: true,
  });

  return NextResponse.json({
    role: 'ADMIN',
    kpis: {
      totalUsers,
      activeUsers,
      totalEmployees,
      totalManagers,
      totalAdmins,
      activeCampaigns,
      totalCampaigns,
      totalVehicles,
      activeVehicles,
      totalCompanies,
      totalZones,
      totalTasks,
      avgExposure: Math.round((avgExposure._avg.exposureScore || 0) * 10) / 10,
      totalDistance: Math.round((totalDistance._sum.distanceFromPreviousPoint || 0) * 10) / 10,
    },
    recentActivity,
    recentUsers,
    campaignStatus: campaignStatus.map((c) => ({ status: c.status, count: c._count })),
    taskStatus: taskStatus.map((t) => ({ status: t.status, count: t._count })),
  });
}

async function managerDashboard(auth: any) {
  // Team members
  const teamMembers = await db.user.findMany({
    where: { managerId: auth.userId },
    select: { id: true, name: true, email: true, jobTitle: true, active: true },
  });

  // Tasks created by manager OR assigned to team
  const tasksCreated = await db.task.count({ where: { assignedById: auth.userId } });
  const tasksAssignedToTeam = await db.task.count({
    where: { assignedTo: { managerId: auth.userId } },
  });

  const pendingTasks = await db.task.count({
    where: {
      OR: [
        { assignedById: auth.userId },
        { assignedTo: { managerId: auth.userId } },
      ],
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
  });
  const completedTasks = await db.task.count({
    where: {
      OR: [
        { assignedById: auth.userId },
        { assignedTo: { managerId: auth.userId } },
      ],
      status: 'COMPLETED',
    },
  });

  // Campaigns (all company campaigns visible to manager)
  const companyId = auth.companyId;
  const activeCampaigns = await db.campaign.count({
    where: { companyId, status: 'ACTIVE' },
  });
  const totalCampaigns = await db.campaign.count({ where: { companyId } });

  // Tasks by status (for team)
  const taskStatus = await db.task.groupBy({
    by: ['status'],
    where: {
      OR: [
        { assignedById: auth.userId },
        { assignedTo: { managerId: auth.userId } },
      ],
    },
    _count: true,
  });

  // Recent tasks
  const recentTasks = await db.task.findMany({
    where: {
      OR: [
        { assignedById: auth.userId },
        { assignedTo: { managerId: auth.userId } },
      ],
    },
    take: 8,
    orderBy: { createdAt: 'desc' },
    include: {
      assignedTo: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
    },
  });

  // Team performance (avg completion rate)
  const teamTaskStats = await Promise.all(
    teamMembers.map(async (m) => {
      const total = await db.task.count({ where: { assignedToId: m.id } });
      const completed = await db.task.count({
        where: { assignedToId: m.id, status: 'COMPLETED' },
      });
      return {
        ...m,
        totalTasks: total,
        completedTasks: completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    })
  );

  return NextResponse.json({
    role: 'MANAGER',
    kpis: {
      teamSize: teamMembers.length,
      activeCampaigns,
      totalCampaigns,
      tasksCreated,
      tasksAssignedToTeam,
      pendingTasks,
      completedTasks,
    },
    taskStatus: taskStatus.map((t) => ({ status: t.status, count: t._count })),
    recentTasks,
    teamMembers: teamTaskStats,
  });
}

async function employeeDashboard(auth: any) {
  // My tasks
  const myTasks = await db.task.count({ where: { assignedToId: auth.userId } });
  const pendingTasks = await db.task.count({
    where: { assignedToId: auth.userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
  });
  const completedTasks = await db.task.count({
    where: { assignedToId: auth.userId, status: 'COMPLETED' },
  });
  const urgentTasks = await db.task.count({
    where: {
      assignedToId: auth.userId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
      priority: 'URGENT',
    },
  });

  // Upcoming deadlines (next 7 days)
  const now = new Date();
  const next7 = new Date();
  next7.setDate(next7.getDate() + 7);
  const upcomingDeadlines = await db.task.findMany({
    where: {
      assignedToId: auth.userId,
      dueDate: { gte: now, lte: next7 },
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
    include: {
      campaign: { select: { id: true, name: true } },
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 5,
  });

  // Recent tasks
  const recentTasks = await db.task.findMany({
    where: { assignedToId: auth.userId },
    include: {
      campaign: { select: { id: true, name: true } },
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
  });

  // My campaigns (campaigns where I have tasks)
  const myCampaignIds = await db.task.findMany({
    where: { assignedToId: auth.userId, campaignId: { not: null } },
    select: { campaignId: true },
    distinct: ['campaignId'],
  });
  const myCampaigns = await db.campaign.findMany({
    where: { id: { in: myCampaignIds.map((c) => c.campaignId) } },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      _count: { select: { tasks: true } },
    },
  });

  // Notifications
  const unreadNotifications = await db.notification.count({
    where: { userId: auth.userId, read: false },
  });

  // Recent activity (mine)
  const recentActivity = await db.activityLog.findMany({
    where: { userId: auth.userId },
    take: 8,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    role: 'EMPLOYEE',
    kpis: {
      myTasks,
      pendingTasks,
      completedTasks,
      urgentTasks,
      myCampaigns: myCampaigns.length,
      unreadNotifications,
    },
    upcomingDeadlines,
    recentTasks,
    myCampaigns,
    recentActivity,
  });
}
