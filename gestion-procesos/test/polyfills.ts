// jest-environment-jsdom no trae TextEncoder/TextDecoder, que React Router necesita.
import { TextDecoder, TextEncoder } from 'node:util'

Object.assign(globalThis, { TextEncoder, TextDecoder })
