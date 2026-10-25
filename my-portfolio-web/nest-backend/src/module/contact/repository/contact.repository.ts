// [REPOSITORY][SRP] queries Prisma de contacto — desacopla persistencia del negocio
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { ContactSubmissionModel } from '../model/contact-submission.model';

@Injectable()
export class ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Devuelve la página y el total en una sola transacción para que el meta sea coherente.
  findPage(
    skip: number,
    take: number,
    where: Prisma.ContactSubmissionWhereInput,
  ): Promise<[ContactSubmissionModel[], number]> {
    return this.prisma.$transaction([
      this.prisma.contactSubmission.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactSubmission.count({ where }),
    ]);
  }

  findById(id: string): Promise<ContactSubmissionModel | null> {
    return this.prisma.contactSubmission.findUnique({ where: { id } });
  }

  create(data: Prisma.ContactSubmissionCreateInput): Promise<ContactSubmissionModel> {
    return this.prisma.contactSubmission.create({ data });
  }

  update(
    id: string,
    data: Prisma.ContactSubmissionUpdateInput,
  ): Promise<ContactSubmissionModel> {
    return this.prisma.contactSubmission.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.contactSubmission.delete({ where: { id } });
  }
}
