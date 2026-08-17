const prisma = require("../../prisma/index");

class NotificationService {
  async notifyUser(
    userId,
    title,
    message,
    channel = "IN_APP"
  ) {
    if (!userId) return null;

    return prisma.notification.create({
      data: {
        userId,
        title,
        message,
        channel
      }
    });
  }

  async markRead(id) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
  }

  async myNotifications(userId) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc"
      }
    });
  }
}

module.exports = new NotificationService();