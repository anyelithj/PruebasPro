// [MVC-C][SRP] solo health-check
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('health')
  health() {
    return {
      success: true,
      data: { status: 'ok', env: this.config.get<string>('app.env') },
    };
  }
}
