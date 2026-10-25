// [OOP] clase base — todos heredan de ella
import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  readonly errorCode: string;

  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode = 'INTERNAL_ERROR',
  ) {
    super(message, status);
    this.errorCode = errorCode;
  }
}
