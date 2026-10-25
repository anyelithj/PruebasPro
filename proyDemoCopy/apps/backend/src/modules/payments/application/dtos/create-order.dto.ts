import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsUUID,
} from 'class-validator';
// [DTOs de Payments · Sprint 7.3]: contratos de entrada validados con class-validator (400 si no cumplen) | [Patrón]: DTO | [Principio]: Fail Fast + SRP
// [Seguridad]: el cliente solo envía ids → precios, títulos y totales los calcula el servidor

// [CreateOrderDto]: cursos del carrito (Next.js y Angular comparten el mismo localStorage «cart»)
export class CreateOrderDto {
  @ApiProperty({ type: [String], description: 'Ids de los cursos del carrito' })
  @ArrayMinSize(1)
  @ArrayMaxSize(20) // Tope razonable por orden
  @ArrayUnique()
  @IsUUID('all', { each: true })
  courseIds!: string[];
}

// [CreateCheckoutSessionDto]: orden pendiente que se va a pagar
export class CreateCheckoutSessionDto {
  @ApiProperty()
  @IsUUID('all')
  orderId!: string;
}
