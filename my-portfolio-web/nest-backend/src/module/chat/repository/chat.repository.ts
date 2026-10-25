// [REPOSITORY][SRP] queries Prisma de mensajes de chat — desacopla persistencia
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { MessageModel } from '../model/message.model';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    sessionId: string;
    role: string;
    content: string;
    userId?: string | null;
  }): Promise<MessageModel> {
    return this.prisma.chatMessage.create({ data });
  }

  // Últimos `take` mensajes de la sesión, en orden cronológico.
  async history(sessionId: string, take = 20): Promise<MessageModel[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.reverse();
  }

  // [ADMIN] sesiones agrupadas: id, nº mensajes y fecha del último — recientes primero.
  async listSessions(): Promise<
    Array<{ sessionId: string; messageCount: number; lastMessageAt: Date }>
  > {
    const groups = await this.prisma.chatMessage.groupBy({
      by: ['sessionId'],
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });
    return groups.map((g) => ({
      sessionId: g.sessionId,
      messageCount: g._count._all,
      lastMessageAt: g._max.createdAt ?? new Date(0),
    }));
  }

  async deleteSession(sessionId: string): Promise<number> {
    const res = await this.prisma.chatMessage.deleteMany({ where: { sessionId } });
    return res.count;
  }

  // [SETTINGS] clave-valor (system prompt del chat, etc.).
  async getSetting(key: string): Promise<string | null> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
