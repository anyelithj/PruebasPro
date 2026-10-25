// [DECORATOR][SRP] marca rutas que no requieren auth
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/app.constants';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
