// [SRP][OOP] lógica del blog — no toca HTTP, delega persistencia al repository
import { Injectable } from '@nestjs/common';
import { NotFoundException } from 'src/common/exceptions/not-found.exception';
import { slugify } from 'src/common/utils/slug.util';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { toPostResponse, PostResponseDto } from '../dto/post-response.dto';
import { PostModel } from '../model/post.model';
import { PostRepository } from '../repository/post.repository';

@Injectable()
export class PostService {
  constructor(private readonly repository: PostRepository) {}

  async listPublished(): Promise<PostResponseDto[]> {
    const posts = await this.repository.findPublished();
    return posts.map(toPostResponse);
  }

  async listAll(): Promise<PostResponseDto[]> {
    const posts = await this.repository.findAll();
    return posts.map(toPostResponse);
  }

  async getById(id: string): Promise<PostResponseDto> {
    return toPostResponse(await this.require(id));
  }

  async getBySlug(slug: string): Promise<PostResponseDto> {
    const post = await this.repository.findBySlug(slug);
    if (!post || !post.published) {
      throw new NotFoundException('Post not found');
    }
    return toPostResponse(post);
  }

  async create(dto: CreatePostDto): Promise<PostResponseDto> {
    const slug = await this.uniqueSlug(dto.title);
    const post = await this.repository.create({
      title: dto.title,
      slug,
      excerpt: dto.excerpt,
      content: dto.content,
      tags: dto.tags,
      imageUrl: dto.imageUrl,
      published: dto.published,
    });
    return toPostResponse(post);
  }

  async update(id: string, dto: UpdatePostDto): Promise<PostResponseDto> {
    await this.require(id);
    const slug = dto.title ? await this.uniqueSlug(dto.title, id) : undefined;
    const post = await this.repository.update(id, { ...dto, ...(slug ? { slug } : {}) });
    return toPostResponse(post);
  }

  async delete(id: string): Promise<void> {
    await this.require(id);
    await this.repository.delete(id);
  }

  private async require(id: string): Promise<PostModel> {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  // Slug URL-safe único; agrega sufijo -2, -3… si colisiona.
  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title) || 'post';
    let candidate = base;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.repository.findBySlug(candidate);
      if (!existing || existing.id === excludeId) {
        return candidate;
      }
      n += 1;
      candidate = `${base}-${n}`;
    }
  }
}
