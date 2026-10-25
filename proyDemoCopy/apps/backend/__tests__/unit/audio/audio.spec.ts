import { NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { QueryFailedError } from 'typeorm';
import { Language } from '../../../src/shared/domain/language.vo';
import { audioKey, normalizeText, objectKey, parseRange } from '../../../src/modules/audio/domain/audio-key';
import { GetAudioUseCase } from '../../../src/modules/audio/application/use-cases/get-audio.use-case';
import { InvalidateAudioUseCase } from '../../../src/modules/audio/application/use-cases/invalidate-audio.use-case';

// [Suite Sprint 4.7 · Audio con caché]: clave determinista, rangos HTTP y Cache-Aside (generar solo al pedirlo)

describe('Clave de caché y rangos (dominio)', () => {
  const req = { text: 'Water', language: Language.EN, variant: 'en-GB' };

  it('la misma palabra con otros espacios o mayúsculas da la misma clave; otra variante o motor, otra', () => {
    expect(normalizeText('  WATER  ')).toBe('water');
    expect(audioKey({ ...req, text: ' water ' }, 'espeak-ng')).toBe(audioKey(req, 'espeak-ng'));
    expect(audioKey({ ...req, variant: 'en-US' }, 'espeak-ng')).not.toBe(audioKey(req, 'espeak-ng'));
    expect(audioKey(req, 'piper')).not.toBe(audioKey(req, 'espeak-ng'));
    expect(objectKey(req, 'k')).toBe('en/en-GB/k.wav');
  });

  it('interpreta Range como el navegador lo envía', () => {
    expect(parseRange(undefined, 1000)).toBeNull();
    expect(parseRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
    expect(parseRange('bytes=-500', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 }); // Fin acotado al tamaño
    expect(parseRange('bytes=2000-', 1000)).toBe('invalid'); // → 416
    expect(parseRange('items=0-1', 1000)).toBe('invalid');
  });
});

// [Dobles de prueba]: repositorio, almacén y voz con jest.fn → sin BD, MinIO ni FastAPI
function make() {
  const repo = { findOne: jest.fn().mockResolvedValue(null), insert: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) };
  const storage = { put: jest.fn().mockResolvedValue(undefined), size: jest.fn(), read: jest.fn().mockResolvedValue(Readable.from(['x'])), remove: jest.fn().mockResolvedValue(undefined) };
  const speech = { engine: 'espeak-ng', synthesize: jest.fn().mockResolvedValue({ audio: Buffer.from('RIFF1234'), voice: 'en-gb', engine: 'espeak-ng' }) };
  return { repo, storage, speech, uc: new GetAudioUseCase(repo as never, storage as never, speech as never) };
}

describe('GetAudioUseCase (Cache-Aside)', () => {
  it('caché vacía: genera una vez, guarda en el almacén y registra la traza', async () => {
    const { repo, storage, speech, uc } = make();
    const res = await uc.execute({ text: 'water', language: Language.EN }, 'tok');
    expect(speech.synthesize).toHaveBeenCalledWith({ text: 'water', language: Language.EN, variant: 'en-GB' }, 'tok');
    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^en\/en-GB\/[a-f0-9]{64}\.wav$/), Buffer.from('RIFF1234'), 'audio/wav');
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ voice: 'en-gb', engine: 'espeak-ng', sizeBytes: 8 }));
    expect(res).toMatchObject({ cached: false, size: 8, variant: 'en-GB' });
  });

  it('caché con objeto: no llama al motor de voz', async () => {
    const { repo, storage, speech, uc } = make();
    repo.findOne.mockResolvedValue({ id: 'a1', objectKey: 'en/en-GB/k.wav', variant: 'en-GB' });
    storage.size.mockResolvedValue(28468);
    const res = await uc.execute({ text: 'water', language: Language.EN }, 'tok');
    expect(speech.synthesize).not.toHaveBeenCalled();
    expect(res).toMatchObject({ cached: true, size: 28468 });
    await res.open({ start: 0, end: 99 });
    expect(storage.read).toHaveBeenCalledWith('en/en-GB/k.wav', { start: 0, end: 99 });
  });

  it('registro sin objeto (borrado a mano): limpia el registro y regenera', async () => {
    const { repo, storage, speech, uc } = make();
    repo.findOne.mockResolvedValue({ id: 'a1', objectKey: 'en/en-GB/k.wav', variant: 'en-GB' });
    storage.size.mockResolvedValue(null);
    const res = await uc.execute({ text: 'water', language: Language.EN }, 'tok');
    expect(repo.delete).toHaveBeenCalledWith({ id: 'a1' });
    expect(speech.synthesize).toHaveBeenCalledTimes(1);
    expect(res.cached).toBe(false);
  });

  it('carrera entre dos peticiones: la clave única duplicada no rompe la respuesta', async () => {
    const { repo, uc } = make();
    repo.insert.mockRejectedValue(new QueryFailedError('INSERT', [], new Error('duplicate key')));
    await expect(uc.execute({ text: 'water', language: Language.EN }, 'tok')).resolves.toMatchObject({ cached: false });
  });
});

describe('InvalidateAudioUseCase', () => {
  it('borra objeto y registro; 404 si no existe', async () => {
    const { repo, storage } = make();
    const uc = new InvalidateAudioUseCase(repo as never, storage as never);
    await expect(uc.execute('nope')).rejects.toBeInstanceOf(NotFoundException);
    repo.findOne.mockResolvedValue({ id: 'a1', objectKey: 'en/en-GB/k.wav' });
    await expect(uc.execute('k')).resolves.toEqual({ deleted: true, key: 'k' });
    expect(storage.remove).toHaveBeenCalledWith('en/en-GB/k.wav');
    expect(repo.delete).toHaveBeenCalledWith({ id: 'a1' });
  });
});
