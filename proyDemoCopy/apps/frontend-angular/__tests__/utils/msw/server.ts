import { setupServer } from 'msw/node';
import { handlers } from './handlers';
// [Servidor msw para Jest]: intercepta fetch en Node (sin red real) | [Patrón]: Test Double (Fake server) + Singleton | [Principio]: SRP

export const server = setupServer(...handlers);
