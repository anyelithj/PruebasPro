// [LSP][SRP]
import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

export class ForbiddenException extends AppException {
  constructor(message = 'Forbidden') {
    super(message, HttpStatus.FORBIDDEN, 'FORBIDDEN');
  }
}
