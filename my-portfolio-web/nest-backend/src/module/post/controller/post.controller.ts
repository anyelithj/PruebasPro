// [MVC-C][SRP] capa HTTP del blog — GET públicos (publicados), mutaciones solo admin
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { idParamSchema } from 'src/common/dto/id-param.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ROLE_ADMIN } from 'src/common/constants/roles.constants';
import { createPostSchema, CreatePostDto } from '../dto/create-post.dto';
import { updatePostSchema, UpdatePostDto } from '../dto/update-post.dto';
import { PostService } from '../service/post.service';
import { POST_ROUTES } from '../route/post.routes';

@Controller(POST_ROUTES.ROOT)
@UseGuards(RolesGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  // Público: solo posts publicados.
  @Get()
  @Public()
  list() {
    return this.postService.listPublished();
  }

  // Admin: todos los posts (incluye borradores). Debe declararse antes de :id.
  @Get(POST_ROUTES.ADMIN)
  @Roles(ROLE_ADMIN)
  listAll() {
    return this.postService.listAll();
  }

  // Público: detalle por slug.
  @Get(POST_ROUTES.BY_SLUG)
  @Public()
  getBySlug(@Param('slug') slug: string) {
    return this.postService.getBySlug(slug);
  }

  // Admin: detalle por id (para editar, incluye borradores).
  @Get(POST_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  get(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    return this.postService.getById(params.id);
  }

  @Post()
  @Roles(ROLE_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(createPostSchema)) dto: CreatePostDto) {
    return this.postService.create(dto);
  }

  @Patch(POST_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updatePostSchema)) dto: UpdatePostDto,
  ) {
    return this.postService.update(params.id, dto);
  }

  @Delete(POST_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    await this.postService.delete(params.id);
    return { success: true, data: null, message: 'Post deleted' };
  }
}
