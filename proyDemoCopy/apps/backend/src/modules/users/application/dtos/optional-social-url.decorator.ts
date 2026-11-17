import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, ValidateBy } from 'class-validator';
import {
  isSocialUrl,
  SOCIAL_HOSTS,
  SOCIAL_URL_MAX_LENGTH,
  socialInvalidMessage,
  type SocialNetwork,
} from '../../domain/value-objects/social-links.vo';
// [@OptionalSocialUrl · 2026-10-28]: decorador compuesto de cada red social del perfil (linkedinUrl, twitterUrl, spotifyUrl, youtubeUrl) | [Patrón]: Decorator + Composite (mismo enfoque que @OptionalPhone) | [Principio]: DRY + SSOT (la regla vive en social-links.vo.ts) + OCP | [Paradigma]: Declarativo (metaprogramación con decoradores)

// `export const` + arrow (ES2015): fábrica parametrizada por red → `@OptionalSocialUrl('linkedin')`
export const OptionalSocialUrl = (network: SocialNetwork): PropertyDecorator =>
  applyDecorators(
    // `@ApiProperty` (Swagger): documenta el campo opcional con un ejemplo del dominio correcto
    ApiProperty({
      required: false,
      maxLength: SOCIAL_URL_MAX_LENGTH,
      example: `https://${SOCIAL_HOSTS[network][0]}/…`,
    }),
    // `@IsOptional` (class-validator): `undefined`/`null` saltan el resto → PATCH parcial
    IsOptional(),
    IsString({ message: socialInvalidMessage(network) }),
    // `@MaxLength`: defensa alineada con `varchar(255)` de la columna
    MaxLength(SOCIAL_URL_MAX_LENGTH, {
      message: socialInvalidMessage(network),
    }),
    // `ValidateBy` (class-validator): validador propio sin clase extra | cadena vacía = borrar el enlace (igual que el teléfono)
    ValidateBy(
      {
        name: `is-${network}-url`,
        validator: {
          validate: (value: unknown) =>
            typeof value === 'string' &&
            (value.trim() === '' || isSocialUrl(network, value.trim())),
        },
      },
      { message: socialInvalidMessage(network) },
    ),
  );
