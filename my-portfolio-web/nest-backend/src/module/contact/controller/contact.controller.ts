// [MVC-C][SRP] capa HTTP de contacto — POST público, bandeja y gestión solo admin
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { idParamSchema } from 'src/common/dto/id-param.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ROLE_ADMIN } from 'src/common/constants/roles.constants';
import { createContactSchema, CreateContactDto } from '../dto/create-contact.dto';
import { listContactSchema, ListContactDto } from '../dto/list-contact.dto';
import { updateContactSchema, UpdateContactDto } from '../dto/update-contact.dto';
import { ContactService } from '../service/contact.service';
import { CONTACT_ROUTES } from '../route/contact.routes';

@Controller(CONTACT_ROUTES.ROOT)
@UseGuards(RolesGuard)
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  submit(@Body(new ZodValidationPipe(createContactSchema)) dto: CreateContactDto, @Ip() ip: string) {
    return this.contactService.submit(dto, ip);
  }

  @Get()
  @Roles(ROLE_ADMIN)
  list(@Query(new ZodValidationPipe(listContactSchema)) query: ListContactDto) {
    return this.contactService.list(query);
  }

  @Get(CONTACT_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  get(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    return this.contactService.getById(params.id);
  }

  @Patch(CONTACT_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateContactSchema)) dto: UpdateContactDto,
  ) {
    return this.contactService.update(params.id, dto);
  }

  @Delete(CONTACT_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    await this.contactService.delete(params.id);
    return { success: true, data: null, message: 'Contact submission deleted' };
  }
}
