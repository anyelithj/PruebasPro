// [FACADE] contact bounded context — formulario público + bandeja de admin (Nest + Prisma).
import { Module } from '@nestjs/common';
import { EmailModule } from 'src/infrastructure/email/email.module';
import { ContactController } from './controller/contact.controller';
import { ContactRepository } from './repository/contact.repository';
import { ContactService } from './service/contact.service';

@Module({
  imports: [EmailModule],
  controllers: [ContactController],
  providers: [ContactService, ContactRepository],
  exports: [ContactService, ContactRepository],
})
export class ContactModule {}
