import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service'; // [2026-10-23]: etiqueta BCP 47 del idioma (en-GB/en-US según acento) para el dictado en vivo
// [VoiceRecorderComponent · Organismo · Sprint 8.9]: graba la voz con MediaRecorder y entrega el audio + duración (juegos orales, shadowing y diálogos) | [Patrón]: State Machine (inactivo → pidiendo permiso → grabando → listo | error) + Observer (`recorded`) | [Principio]: SRP (solo graba; transcribir es de SpeechFacade) | [Paradigma]: Reactivo (signals)
// [A11y]: estado del micrófono en texto + punto rojo (no solo color), región `aria-live` que anuncia «Grabando» y el contador, botón con nombre que cambia · [Privacidad]: el micrófono se apaga al parar (se cierran las pistas)

export type RecorderState = 'idle' | 'asking' | 'recording' | 'done' | 'error';
export interface Recording {
  blob: Blob; // Audio (webm/opus en Chrome y Firefox, mp4 en Safari)
  durationMs: number;
  liveText?: string; // [2026-10-23]: lo que dictó el navegador en vivo ('' sin Web Speech) → respaldo si Whisper no responde
}

// [LiveRecognition]: lo mínimo de la Web Speech API (TypeScript no la declara: no está en todos los navegadores)
export interface LiveRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  start(): void;
  stop(): void;
}

// [Textos]: los pasa el contenedor (i18n) → el organismo no depende del diccionario
export interface RecorderLabels {
  start: string;
  stop: string;
  recording: string; // «Grabando…»
  ready: string; // «Grabación lista»
  denied: string; // «Permite el micrófono…»
}

@Component({
  selector: 'aula-voice-recorder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <div class="flex flex-wrap items-center gap-3">
      @if (state() === 'recording') {
        <button
          type="button"
          (click)="stop()"
          class="btn btn-danger btn-lg min-w-40"
          [attr.aria-label]="labels().stop"
        >
          <span class="size-3 rounded-sm bg-white" aria-hidden="true"></span>{{ labels().stop }}
        </button>
      } @else {
        <button
          type="button"
          (click)="start()"
          [disabled]="disabled() || state() === 'asking'"
          class="btn btn-primary btn-lg min-w-40"
        >
          <!-- Icono «micrófono» (lucide), decorativo -->
          <svg
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M12 19v3M19 10v2a7 7 0 0 1-14 0v-2M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z" />
          </svg>
          {{ labels().start }}
        </button>
      }
      <!-- [Estado del micrófono]: texto + punto pulsante; aria-live="polite" anuncia los cambios sin interrumpir -->
      <p class="flex items-center gap-2 text-sm font-semibold" aria-live="polite">
        @switch (state()) {
          @case ('recording') {
            <span
              class="size-2.5 rounded-full bg-red-600 motion-safe:animate-pulse"
              aria-hidden="true"
            ></span>
            <span class="text-tone-danger">{{ labels().recording }} {{ clock() }}</span>
          }
          @case ('done') {
            <span class="text-tone-brand">✓ {{ labels().ready }} ({{ clock() }})</span>
          }
          @case ('error') {
            <span role="alert" class="text-tone-danger">{{ error() }}</span>
          }
        }
      </p>
    </div>
  `,
})
export class VoiceRecorderComponent {
  readonly labels = input.required<RecorderLabels>();
  readonly maxSeconds = input(120); // Corte automático (hablar contra reloj: 30/60/90)
  readonly disabled = input(false);
  // [language · 2026-10-23]: si se pasa, el navegador (Chrome/Edge) transcribe EN VIVO mientras se habla y emite `transcript`
  // → el contenedor lo pone en su campo para que el alumno vea y corrija sus errores antes de enviar (antes quedaba «✓ Grabación lista» sin uso)
  readonly language = input<string | null>(null);
  readonly recorded = output<Recording>(); // `output` (Angular 17+): evento tipado hacia el contenedor
  readonly started = output<void>();
  readonly transcript = output<string>(); // Texto dictado en vivo (se va actualizando)

  readonly state = signal<RecorderState>('idle');
  readonly error = signal('');
  private readonly elapsed = signal(0); // Segundos grabados (contador visible)
  protected readonly clock = computed(() => {
    const s = this.elapsed();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; // mm:ss
  });

  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private live: LiveRecognition | null = null;
  private liveText = '';
  private readonly voices = inject(SpeechSynthesisService);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release()); // [Limpieza]: salir de la página apaga el micrófono
  }

  // [start]: pide permiso (`getUserMedia`) y empieza a grabar | `async/await` (ES2017)
  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return this.fail(this.labels().denied); // Navegador sin MediaRecorder (o página sin HTTPS)
    }
    this.state.set('asking');
    try {
      // [2026-10-25 · Audio cortado/robótico]: la supresión de ruido y el control de ganancia del navegador «recortan» la voz (sobre todo con el dictado en vivo abierto a la vez)
      // → voz natural en mono
      this.stream = await navigator.mediaDevices.getUserMedia({
        // [2026-10-26]: sin echoCancellation → con el dictado (Web Speech) abierto a la vez, el AEC de Chrome en Windows dejaba la voz cortada y «robótica»; en el turno del alumno el avatar está callado
        audio: { channelCount: 1, sampleRate: 48_000, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      return this.fail(this.labels().denied); // Permiso denegado o sin micrófono
    }
    this.chunks = [];
    // Opus a 128 kbps (por defecto Chrome usa ~32 kbps) · Safari no tiene webm → su formato por defecto
    const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported?.(t));
    this.recorder = new MediaRecorder(this.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 128_000 });
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
      this.release();
      this.state.set('done');
      this.recorded.emit({ blob, durationMs: Date.now() - this.startedAt, liveText: this.liveText });
    };
    this.startedAt = Date.now();
    this.elapsed.set(0);
    this.recorder.start();
    this.state.set('recording');
    this.started.emit();
    this.dictate();
    // [Contador]: un tic por segundo; al llegar al máximo se para solo
    this.timer = setInterval(() => {
      this.elapsed.update((s) => s + 1);
      if (this.elapsed() >= this.maxSeconds()) this.stop();
    }, 1000);
  }

  stop(): void {
    clearInterval(this.timer);
    if (this.recorder?.state === 'recording') this.recorder.stop(); // `onstop` entrega el audio
  }

  // [dictate · Progressive Enhancement]: Web Speech API en paralelo a MediaRecorder; sin soporte o sin permiso → solo Whisper al terminar
  private dictate(): void {
    this.liveText = '';
    const lang = this.language();
    const w = window as unknown as Record<string, (new () => LiveRecognition) | undefined>;
    const Recognition = w['SpeechRecognition'] ?? w['webkitSpeechRecognition'];
    if (!lang || !Recognition) return;
    const r = new Recognition();
    r.lang = this.voices.voiceLang(lang);
    r.interimResults = true; // Resultados parciales → el texto aparece mientras se habla
    r.continuous = true;
    r.onresult = (e) => {
      this.liveText = Array.from(e.results, (x) => x[0]?.transcript ?? '').join(' ').trim();
      this.transcript.emit(this.liveText);
    };
    r.onerror = () => undefined; // Sin red o sin permiso: Whisper lo resuelve al terminar
    try {
      r.start();
      this.live = r;
    } catch {
      this.live = null;
    }
  }

  private fail(message: string): void {
    this.release();
    this.error.set(message);
    this.state.set('error');
  }

  // [release]: corta el contador y apaga cada pista → el indicador de micrófono del navegador se apaga
  private release(): void {
    clearInterval(this.timer);
    this.live?.stop(); // Apaga también el dictado en vivo
    this.live = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
