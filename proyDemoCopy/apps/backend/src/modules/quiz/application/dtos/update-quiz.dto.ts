import { PartialType } from '@nestjs/swagger';
import { CreateQuizDto } from './create-quiz.dto';
// [DTO UpdateQuiz]: input PATCH /quiz/:id — mismos campos y validaciones que CreateQuizDto, todos opcionales | [Patrón]: DTO + Mapped Type | [Principio]: DRY + OCP | [Paradigma]: POO (herencia de clase)
// [Seguridad]: al ser una CLASE, el ValidationPipe global (whitelist + forbidNonWhitelisted) valida y rechaza campos no declarados
// (p. ej. authorId, source) → evita asignación masiva. Con un tipo inline (interface) el pipe no puede validar nada.

// `export class ... extends` (TS/ES2015): herencia; `PartialType` (@nestjs/swagger) genera en runtime una clase con todas
// las propiedades opcionales y CONSERVA los decoradores de class-validator y de Swagger de la clase base.
export class UpdateQuizDto extends PartialType(CreateQuizDto) {}
