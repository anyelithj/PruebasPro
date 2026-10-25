// [REPOSITORY][SRP] queries Prisma de notificaciones — desacopla persistencia
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { NotificationModel } from '../model/notification.model';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    channel: string;
    recipient: string;
    message: string;
    status: string;
    eventType?: string | null;
  }): Promise<NotificationModel> {
    return this.prisma.notification.create({ data });
  }

  updateStatus(id: string, status: string): Promise<NotificationModel> {
    return this.prisma.notification.update({ where: { id }, data: { status } });
  }

  findById(id: string): Promise<NotificationModel | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  findPage(skip: number, take: number): Promise<[NotificationModel[], number]> {
    return this.prisma.$transaction([
      this.prisma.notification.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count(),
    ]);
  }
}
