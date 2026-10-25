// [LSP][SRP]
import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

export class ValidationException extends AppException {
  readonly details?: unknown;

  constructor(message = 'Validation failed', details?: unknown) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Unauthorized') {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ConflictException extends AppException {
  constructor(message = 'Conflict') {
    super(message, HttpStatus.CONFLICT, 'CONFLICT');
  }
}
