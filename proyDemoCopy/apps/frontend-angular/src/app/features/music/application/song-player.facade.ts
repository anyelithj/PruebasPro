import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { LipSyncService } from '@core/audio/lip-sync.service';
import { lineAt, lineProgress, type TranscriptLine } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
import type { AvatarState } from '@shared/ui/organisms/avatar-stage/avatar-state';
import { toTranscript, type SongDetail } from '../domain/models/music';
// [SongPlayerFacade · Aplicación · Sprint 9.8 · RF-118/RF-119]: tiempo del audio y línea actual del karaoke — reproducir, pausar, saltar a una línea, repetirla en bucle y velocidad 0,75x/1x | [Patrón]: Facade + State Machine (detenida → cantando ⇄ pausada) + Observer (eventos del <audio>) | [Principio]: SRP (la página solo pinta) | [Paradigma]: Reactivo (signals)
// [Avatar]: «canta» con LipSyncService — volumen real del audio o animación sintética si el audio viene de otro origen

export type PlayerState = 'stopped' | 'singing' | 'paused';

// [MELODY · 2026-11-02]: tono por palabra (Web Speech `pitch` 0–2) → la voz del navegador «canta» una melodía sencilla en vez de hablar plano
// ponytail: melodía fija de 8 notas; una melodía por canción (notas en la BD) si los docentes la piden
const MELODY = [1.0, 1.25, 1.5, 1.25, 1.1, 1.4, 0.9, 1.2] as const;

@Injectable()
export class SongPlayerFacade {
  readonly lipSync = inject(LipSyncService);
  readonly song = signal<SongDetail | null>(null);
  readonly state = signal<PlayerState>('stopped');
  readonly time = signal(0);
  readonly duration = signal(0);
  readonly rate = signal<0.75 | 1>(1);
  readonly loop = signal<number | null>(null); // Línea que se repite (practicar un verso)
  readonly follow = signal(true);
  private readonly raw = computed(() => (this.song()?.lines ?? []).map(toTranscript));
  readonly timed = computed(() => this.raw().some((l) => l.start != null)); // Tiempos reales (sincronizados o de los subtítulos)
  // [2026-11-05]: sin tiempos pero con duración conocida (YouTube o audio) → tiempos estimados por longitud del verso → la letra se marca igualmente
  readonly lines = computed(() => (this.timed() || !this.duration() ? this.raw() : estimateTimings(this.raw(), this.duration())));
  // [offset · 2026-11-06]: ajuste fino de la letra (s) → «el marcador va antes que la canción» se corrige con ± o pulsando el verso que suena | positivo = la letra se retrasa
  readonly offset = signal(0);
  private readonly lyricTime = computed(() => this.time() - this.offset());
  // [anchored · 2026-11-06 · «el marcador corre con la música sin que canten»]: con tiempos ESTIMADOS no se marca nada hasta que alguien indique dónde empieza la voz
  // (botón «Ya empezó a cantar» o pulsar el verso que suena) → la intro instrumental ya no arrastra la letra | con tiempos reales (sincronizados, subtítulos o alineación) va solo
  readonly anchored = signal(false);
  // [2026-11-09]: sin espera manual («Ya empezó a cantar» se quitó) → los tiempos aproximados ya reservan la intro; el verso pulsado afina el resto
  readonly waiting = computed(() => false);
  readonly current = computed(() => (this.waiting() ? -1 : lineAt(this.lines(), this.lyricTime())));
  readonly progress = computed(() => lineProgress(this.lines()[this.current()], this.lyricTime())); // [2026-10-23]: marcador de karaoke dentro del verso
  readonly avatar = computed<AvatarState>(() => (this.state() === 'singing' ? 'singing' : 'idle'));
  private audio: HTMLAudioElement | null = null;
  private yt: { frame: HTMLIFrameElement; listener: (e: MessageEvent) => void; raf: number; at: number; t: number; rate: number; retry: ReturnType<typeof setInterval> } | null = null; // Reproductor de YouTube vinculado
  private readonly voice = inject(SpeechSynthesisService);
  readonly sing = signal(true); // [2026-11-02]: el avatar canta la letra con la voz del navegador (se puede apagar si la pista ya trae voz)

  constructor() {
    // Canción nueva → sin ancla ni ajuste
    effect(() => {
      this.song();
      untracked(() => {
        this.anchored.set(false);
        this.offset.set(0);
      });
    });
    // Con la pista sonando: cada verso nuevo se canta | `effect` (signals): reacciona a la línea actual
    effect(() => {
      const i = this.current();
      // [2026-11-06]: también con el vídeo de YouTube (antes solo con archivo) · el micrófono del escenario lo silencia (`sing`)
      if (this.state() === 'singing' && this.sing() && (this.audio?.src || this.yt) && i >= 0) untracked(() => this.singLines([this.lines()[i].text]));
    });
  }

  // [singLines]: una frase por palabra con su nota (la cola de speechSynthesis las encadena) + boca del avatar al ritmo de cada palabra
  singLines(texts: readonly string[], onDone?: () => void): void {
    if (!this.voice.supported) return onDone?.();
    const synth = window.speechSynthesis;
    synth.cancel();
    const words = texts.flatMap((t) => t.split(/\s+/).filter(Boolean));
    words.forEach((w, k) => {
      const u = new SpeechSynthesisUtterance(w);
      u.lang = this.voice.voiceLang(this.song()?.language ?? 'en');
      u.voice = this.voice.bestVoice(this.song()?.language ?? 'en');
      u.pitch = MELODY[k % MELODY.length];
      u.rate = 0.8 * this.rate(); // Más lento que hablar: las vocales se alargan
      u.onstart = () => this.lipSync.level.set(0.75);
      u.onend = () => {
        this.lipSync.level.set(0.15);
        if (k === words.length - 1) onDone?.();
      };
      synth.speak(u);
    });
  }

  // [singAll]: canción sin pista de audio → el avatar canta toda la letra
  singAll(): void {
    if (this.state() === 'singing') return this.stop();
    this.state.set('singing');
    this.singLines(
      this.lines().map((l) => l.text),
      () => this.state.set('stopped'),
    );
  }

  // [bind]: conecta los eventos del elemento <audio> (lo crea la página) con las signals
  bind(el: HTMLAudioElement): void {
    this.audio = el;
    el.playbackRate = this.rate();
    el.ontimeupdate = () => {
      this.time.set(el.currentTime);
      const l = this.loop() == null ? null : this.lines()[this.loop()!];
      if (l?.start != null && l.end != null && el.currentTime >= l.end) el.currentTime = l.start; // Bucle de la línea
    };
    el.onloadedmetadata = () => this.duration.set(el.duration || 0);
    el.onplay = () => {
      this.state.set('singing');
      this.lipSync.attach(el);
    };
    el.onpause = () => {
      this.state.set(el.ended || el.currentTime === 0 ? 'stopped' : 'paused');
      if (this.voice.supported) window.speechSynthesis.cancel(); // Pausa la pista → calla la voz
    };
    el.onended = () => {
      this.state.set('stopped');
      this.lipSync.detach();
    };
  }

  // [bindYouTube · 2026-11-05]: la letra sigue al vídeo de YouTube — el iframe (con enablejsapi=1) envía `infoDelivery` con currentTime/playerState por postMessage
  // Entre mensajes (~cada 0,5 s) el tiempo se interpola con requestAnimationFrame → el marcador avanza suave | sin cargar el script de la IFrame API
  bindYouTube(frame: HTMLIFrameElement): void {
    this.unbindYouTube();
    const hello = () => frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'aula-song', channel: 'widget' }), '*');
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
      let msg: { event?: string; info?: unknown } | undefined;
      try {
        msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!msg || !this.yt) return;
      // [Fix 2026-11-06 · avatar «En reposo»]: YouTube también avisa con `onStateChange` y `info` NUMÉRICO (antes se ignoraba)
      const info = (typeof msg.info === 'number' ? { playerState: msg.info } : msg.info) as
        | { currentTime?: number; duration?: number; playerState?: number; playbackRate?: number }
        | undefined;
      if (!info) return;
      clearInterval(retry); // [2026-11-05]: el reproductor ya habla → basta de saludos
      if (typeof info.duration === 'number' && info.duration > 0) this.duration.set(info.duration);
      if (typeof info.playbackRate === 'number' && info.playbackRate > 0) this.yt.rate = info.playbackRate;
      if (typeof info.currentTime === 'number') {
        // Sin playerState en el mensaje: si el tiempo avanzó, está sonando
        if (info.playerState === undefined && this.yt.at && info.currentTime > this.yt.t + 0.05) this.state.set('singing');
        this.yt.t = info.currentTime;
        this.yt.at = performance.now();
        this.time.set(info.currentTime);
      }
      // playerState: 1 = reproduciendo · 2 = pausa · 0 = terminó
      if (info.playerState === 1) this.state.set('singing');
      else if (info.playerState === 2 || info.playerState === 0) {
        this.state.set(info.playerState === 2 ? 'paused' : 'stopped');
        if (this.voice.supported) window.speechSynthesis.cancel(); // Vídeo en pausa → calla la voz del avatar
      }
    };
    frame.addEventListener('load', hello);
    window.addEventListener('message', listener);
    // [Fix 2026-11-05 · avatar «En reposo» y letra quieta]: el reproductor ignora el saludo si aún no cargó su JS → se repite cada 500 ms hasta la primera respuesta (como la IFrame API oficial)
    const retry = setInterval(hello, 500);
    this.yt = { frame, listener, raf: 0, at: 0, t: 0, rate: 1, retry };
    hello();
    const tick = (now: number) => {
      const yt = this.yt;
      if (!yt) return;
      if (this.state() === 'singing' && yt.at) {
        // [Fix 2026-11-06]: interpolación con la velocidad real y tope de 1 s sin noticias (buffering/anuncio → el marcador ya no se adelanta a la canción)
        this.time.set(yt.t + Math.min(1, ((now - yt.at) / 1000) * yt.rate));
        this.lipSync.level.set(0.35 + 0.3 * Math.abs(Math.sin(now / 140))); // Boca sintética (el audio del iframe no se puede analizar)
      } else this.lipSync.level.set(0);
      yt.raf = requestAnimationFrame(tick);
    };
    this.yt.raf = requestAnimationFrame(tick);
  }

  private unbindYouTube(): void {
    if (!this.yt) return;
    cancelAnimationFrame(this.yt.raf);
    clearInterval(this.yt.retry);
    window.removeEventListener('message', this.yt.listener);
    this.yt = null;
  }

  toggle(): void {
    if (!this.audio) return;
    if (this.audio.paused) void this.audio.play().catch(() => this.state.set('stopped'));
    else this.audio.pause();
  }

  // [alignTo · 2026-11-06]: «este verso se canta AHORA» → ajusta `offset` (vídeo de YouTube o letra sin tiempos fiables)
  alignTo(i: number): void {
    const start = this.lines()[i]?.start;
    if (start == null) return;
    this.offset.set(Math.round((this.time() - start) * 10) / 10);
    this.anchored.set(true);
  }

  nudge(seconds: number): void {
    this.offset.update((o) => Math.round((o + seconds) * 10) / 10);
  }

  seekLine(i: number): void {
    const start = this.lines()[i]?.start;
    if (!this.audio || start == null) return;
    this.audio.currentTime = start;
    this.time.set(start);
    if (this.audio.paused) void this.audio.play().catch(() => undefined);
  }

  // [repeat]: activa o quita el bucle de la línea actual (o de la indicada)
  repeat(i = this.current()): void {
    this.loop.set(this.loop() === i || i < 0 ? null : i);
    if (this.loop() != null) this.seekLine(i);
  }

  setRate(r: 0.75 | 1): void {
    this.rate.set(r);
    if (this.audio) this.audio.playbackRate = r; // `playbackRate` conserva el tono en los navegadores modernos (preservesPitch)
  }

  stop(): void {
    this.unbindYouTube();
    this.audio?.pause();
    if (this.voice.supported) window.speechSynthesis.cancel();
    this.state.set('stopped');
    this.lipSync.detach();
  }
}

// [estimateTimings · 2026-11-05]: reparte la duración entre los versos según su longitud (sin tiempos guardados) | Función pura
// ponytail: ignora intro/solos instrumentales; tiempos reales con «Sincronización» o subtítulos de YouTube
// [Fix 2026-11-06 · marcador adelantado]: antes la letra empezaba en 0 s y ocupaba toda la duración → con intro/final instrumentales iba por delante de la voz
// ahora se reserva una intro (8 %, máx. 15 s) y un final (5 %) sin letra; el resto se afina con `offset`
export function estimateTimings(lines: readonly TranscriptLine[], duration: number): TranscriptLine[] {
  const total = lines.reduce((n, l) => n + l.text.length + 8, 0) || 1; // +8: pausa mínima entre versos
  const intro = Math.min(15, duration * 0.08);
  const sung = duration - intro - duration * 0.05;
  let t = intro;
  return lines.map((l) => {
    const start = t;
    t += (sung * (l.text.length + 8)) / total;
    return { ...l, start, end: t };
  });
}
