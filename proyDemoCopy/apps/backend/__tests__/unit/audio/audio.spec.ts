import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Readable } from 'stream';
import { QueryFailedError } from 'typeorm';
import { Language } from '../../../src/shared/domain/language.vo';
import { audioKey, normalizeText, objectKey, parseRange } from '../../../src/modules/audio/domain/audio-key';
import { GetAudioUseCase } from '../../../src/modules/audio/application/use-cases/get-audio.use-case';
import { InvalidateAudioUseCase } from '../../../src/modules/audio/application/use-cases/invalidate-audio.use-case';
import { inspectWav, silenceReason } from '../../../src/modules/audio/domain/wav-audibility';

// [wav · 2026-10-24]: WAV PCM 16 bits mono con un tono de 440 Hz (`amp` 0..1; 0 = silencio) → audio real para los dobles de prueba
function wav(amp: number, seconds = 0.25, rate = 22050): Buffer {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8, 'ascii');
  b.writeUInt32LE(16, 16); // Tamaño del chunk fmt
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // Mono
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); // Bytes por segundo
  b.writeUInt16LE(2, 32); // Bytes por muestra
  b.writeUInt16LE(16, 34); // Bits por muestra
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(amp * 32767 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  return b;
}
const TONE = wav(0.5);

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

describe('Control de silencio del WAV (dominio · 2026-10-24)', () => {
  it('mide duración, RMS y pico de un tono', () => {
    const st = inspectWav(TONE)!;
    expect(st).toMatchObject({ sampleRate: 22050, channels: 1, bitsPerSample: 16 });
    expect(st.durationS).toBeCloseTo(0.25, 3);
    expect(st.peak).toBeCloseTo(0.5, 2);
    expect(st.rms).toBeCloseTo(0.5 / Math.SQRT2, 2); // RMS de una senoide = pico/√2
    expect(silenceReason(TONE)).toBeNull();
  });

  it('detecta audio mudo, vacío o que no es WAV', () => {
    expect(silenceReason(wav(0))).toMatch(/silencio/);
    expect(silenceReason(wav(0.0005))).toMatch(/silencio/); // < -60 dBFS
    expect(silenceReason(wav(0.5, 0))).toMatch(/vacío/);
    expect(silenceReason(Buffer.from('RIFF1234'))).toMatch(/WAV/);
  });

  it('tolera la cabecera de `espeak-ng --stdout` (tamaños 0x7FFFF000) midiendo los bytes reales', () => {
    const b = Buffer.from(TONE);
    b.writeUInt32LE(0x7ffff024, 4);
    b.writeUInt32LE(0x7ffff000, 40);
    expect(inspectWav(b)!.durationS).toBeCloseTo(0.25, 3);
  });
});

// [Dobles de prueba]: repositorio, almacén y voz con jest.fn → sin BD, MinIO ni FastAPI
function make() {
  const repo = { findOne: jest.fn().mockResolvedValue(null), insert: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) };
  const storage = { put: jest.fn().mockResolvedValue(undefined), size: jest.fn(), read: jest.fn().mockResolvedValue(Readable.from(['x'])), remove: jest.fn().mockResolvedValue(undefined) };
  const speech = { engine: 'espeak-ng', synthesize: jest.fn().mockResolvedValue({ audio: TONE, voice: 'en-gb', engine: 'espeak-ng' }) };
  return { repo, storage, speech, uc: new GetAudioUseCase(repo as never, storage as never, speech as never) };
}

describe('GetAudioUseCase (Cache-Aside)', () => {
  it('caché vacía: genera una vez, guarda en el almacén y registra la traza', async () => {
    const { repo, storage, speech, uc } = make();
    const res = await uc.execute({ text: 'water', language: Language.EN }, 'tok');
    expect(speech.synthesize).toHaveBeenCalledWith({ text: 'water', language: Language.EN, variant: 'en-GB' }, 'tok');
    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^en\/en-GB\/[a-f0-9]{64}\.wav$/), TONE, 'audio/wav');
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ voice: 'en-gb', engine: 'espeak-ng', sizeBytes: TONE.length }));
    expect(res).toMatchObject({ cached: false, size: TONE.length, variant: 'en-GB' });
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

  it('audio en silencio del motor: 503 y NO se guarda en la caché (2026-10-24)', async () => {
    const { repo, storage, speech, uc } = make();
    speech.synthesize.mockResolvedValue({ audio: wav(0), voice: 'en-us', engine: 'espeak-ng' });
    await expect(uc.execute({ text: "That's great!", language: Language.EN, variant: 'en-US' }, 'tok')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(storage.put).not.toHaveBeenCalled();
    expect(repo.insert).not.toHaveBeenCalled();
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
