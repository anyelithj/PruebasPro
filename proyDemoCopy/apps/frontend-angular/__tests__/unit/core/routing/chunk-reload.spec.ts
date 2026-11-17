import { isChunkError, reloadOnChunkError } from '@core/routing/chunk-reload';
// [chunk-reload]: recarga una sola vez ante un chunk caducado; otros errores no recargan | [Herramienta]: Jest

describe('reloadOnChunkError', () => {
  const chunkError = new TypeError('Failed to fetch dynamically imported module: http://localhost:9000/ng/chunk-E2HTXLVR.js');

  beforeEach(() => sessionStorage.clear());

  it('solo reconoce errores de carga de chunks', () => {
    expect(isChunkError(chunkError)).toBe(true);
    expect(isChunkError(new Error('HTTP 500'))).toBe(false);
  });

  it('recarga la primera vez y no entra en bucle si el chunk sigue fallando', () => {
    const navigate = jest.fn();
    expect(reloadOnChunkError(chunkError, '/traductor', navigate)).toBe(true);
    expect(reloadOnChunkError(chunkError, '/traductor', navigate)).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/traductor');
  });
});
