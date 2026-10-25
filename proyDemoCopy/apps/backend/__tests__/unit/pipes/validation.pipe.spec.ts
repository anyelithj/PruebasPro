import { ValidationPipe } from '@nestjs/common';
import { IsEmail, IsInt, Min } from 'class-validator';
import {
  GLOBAL_VALIDATION_OPTIONS,
  globalValidationPipe,
} from '../../../src/shared/pipes/validation.pipe';

class SampleDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(0)
  age!: number;
}

describe('globalValidationPipe', () => {
  it('opciones endurecidas: whitelist + forbidNonWhitelisted + transform', () => {
    expect(GLOBAL_VALIDATION_OPTIONS.whitelist).toBe(true);
    expect(GLOBAL_VALIDATION_OPTIONS.forbidNonWhitelisted).toBe(true);
    expect(GLOBAL_VALIDATION_OPTIONS.transform).toBe(true);
  });

  it('factory devuelve una instancia de ValidationPipe', () => {
    expect(globalValidationPipe()).toBeInstanceOf(ValidationPipe);
  });

  const meta = { type: 'body' as const, metatype: SampleDto, data: '' };

  it('transforma y coacciona tipos (string "5" -> number 5)', async () => {
    const pipe = globalValidationPipe();
    const out = await pipe.transform(
      { email: 'a@b.com', age: '5' },
      meta,
    );
    expect(out.age).toBe(5);
    expect(out).toBeInstanceOf(SampleDto);
  });

  it('rechaza propiedades no declaradas (anti mass-assignment)', async () => {
    const pipe = globalValidationPipe();
    await expect(
      pipe.transform({ email: 'a@b.com', age: 1, isAdmin: true }, meta),
    ).rejects.toThrow();
  });

  it('rechaza valores invalidos del DTO', async () => {
    const pipe = globalValidationPipe();
    await expect(
      pipe.transform({ email: 'no-email', age: -1 }, meta),
    ).rejects.toThrow();
  });
});
