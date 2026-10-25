// [MVC-C][SRP] GET/PATCH/DELETE — solo delega al service; máx pocas líneas por método
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { idParamSchema } from 'src/common/dto/id-param.dto';
import { paginationSchema, PaginationDto } from 'src/common/dto/pagination.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ROLE_ADMIN } from 'src/common/constants/roles.constants';
import { createUserSchema, CreateUserDto } from '../dto/create-user.dto';
import { updateUserSchema, UpdateUserDto } from '../dto/update-user.dto';
import { toUserResponse, UserResponseDto } from '../dto/user-response.dto';
import { UserModel } from '../model/user.model';
import { UserService } from '../service/user.service';
import { USER_ROUTES } from '../route/user.routes';

@Controller(USER_ROUTES.ROOT)
@UseGuards(RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(USER_ROUTES.ME)
  me(@CurrentUser() user: UserModel): UserResponseDto {
    return toUserResponse(user);
  }

  @Get()
  @Roles(ROLE_ADMIN)
  list(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationDto) {
    return this.userService.list(query.page, query.pageSize);
  }

  @Post()
  @Roles(ROLE_ADMIN)
  create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get(USER_ROUTES.BY_ID)
  get(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    return this.userService.getById(params.id);
  }

  @Patch(USER_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.userService.update(params.id, dto);
  }

  @Delete(USER_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    await this.userService.delete(params.id);
    return { success: true, data: null, message: 'User deleted' };
  }
}
