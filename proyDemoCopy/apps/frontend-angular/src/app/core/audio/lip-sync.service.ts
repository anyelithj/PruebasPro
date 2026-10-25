import { DestroyRef, inject, Injectable, signal } from '@angular/core';
// [LipSyncService · core/audio · Sprint 9.7 · RF-118/RF-122]: abre y cierra la boca del avatar según el volumen del audio (Web Audio API, AnalyserNode) o según los eventos de palabra de la voz del navegador | [Patrón]: Observer (signal `level`) + Strategy (análisis real → respaldo sintético) | [Principio]: SRP (solo calcula 0..1; dibujar es de AvatarSvg) + degradación elegante | [Paradigma]: Reactivo (signals) + bucle requestAnimationFrame
// [Por qué captureStream y no createMediaElementSource]: este último desvía la salida del <audio> al AudioContext; con audio de otro origen sin CORS (URL firmada de MinIO/R2) el navegador lo silenciaría. `captureStream()` solo copia la señal y, si el origen no lo permite, lanza → respaldo sintético sin perder el sonido

interface CapturableMedia extends HTMLMediaElement {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream; // Firefox
}

@Injectable({ providedIn: 'root' })
export class LipSyncService {
  readonly level = signal(0); // 0 = boca cerrada · 1 = abierta del todo
  readonly analysed = signal(false); // true = el volumen es real (análisis); false = animación sintética
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private decay: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detach());
  }

  // [attach]: empieza a seguir el volumen del elemento de audio (canción o diálogo con audio)
  attach(el: HTMLMediaElement): void {
    this.detach();
    const media = el as CapturableMedia;
    try {
      const stream = (media.captureStream ?? media.mozCaptureStream)?.call(media);
      if (!stream?.getAudioTracks().length || typeof AudioContext === 'undefined')
        throw new Error('sin pista');
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.ctx.createMediaStreamSource(stream).connect(this.analyser); // Solo análisis: no se conecta a los altavoces
      this.analysed.set(true);
    } catch {
      this.analysed.set(false); // Audio de otro origen, navegador sin captureStream o aún sin pista → boca sintética
    }
    const data = new Uint8Array(this.analyser?.frequencyBinCount ?? 0);
    const loop = (t: number) => {
      if (el.paused) this.level.set(0);
      else if (this.analyser) {
        this.analyser.getByteTimeDomainData(data); // Onda: 128 = silencio
        const rms = Math.sqrt(data.reduce((s, v) => s + ((v - 128) / 128) ** 2, 0) / data.length);
        this.level.set(Math.min(1, rms * 4));
      } else this.level.set(0.35 + 0.3 * Math.abs(Math.sin(t / 140))); // Respaldo: abre y cierra a ritmo de sílaba
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // [pulse]: un evento de palabra de SpeechSynthesis → abre la boca y la cierra poco después (la voz sintética no se puede analizar)
  pulse(strength = 0.8): void {
    this.level.set(strength);
    clearTimeout(this.decay);
    this.decay = setTimeout(() => this.level.set(0.15), 160);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.decay);
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.level.set(0);
  }
}
