import { db } from './db';

/**
 * Log a user activity. Safe to call — errors are swallowed.
 */
export async function logActivity(
  userId: string,
  action: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId,
        action,
        entity: entity || null,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (e) {
    // Non-critical — don't fail the request
    console.error('Failed to log activity:', e);
  }
}

/**
 * Create a notification for a user.
 */
export async function notify(
  userId: string,
  title: string,
  message: string,
  type: 'INFO' | 'TASK' | 'SYSTEM' | 'CAMPAIGN' = 'INFO',
  link?: string
): Promise<void> {
  try {
    await db.notification.create({
      data: { userId, title, message, type, link: link || null },
    });
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}
