import { computed, inject, Injectable, signal } from '@angular/core';
import { LipSyncService } from '@core/audio/lip-sync.service';
import { lineAt, lineProgress } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
import type { AvatarState } from '@shared/ui/organisms/avatar-stage/avatar-state';
import { toTranscript, type SongDetail } from '../domain/models/music';
// [SongPlayerFacade · Aplicación · Sprint 9.8 · RF-118/RF-119]: tiempo del audio y línea actual del karaoke — reproducir, pausar, saltar a una línea, repetirla en bucle y velocidad 0,75x/1x | [Patrón]: Facade + State Machine (detenida → cantando ⇄ pausada) + Observer (eventos del <audio>) | [Principio]: SRP (la página solo pinta) | [Paradigma]: Reactivo (signals)
// [Avatar]: «canta» con LipSyncService — volumen real del audio o animación sintética si el audio viene de otro origen

export type PlayerState = 'stopped' | 'singing' | 'paused';

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
  readonly lines = computed(() => (this.song()?.lines ?? []).map(toTranscript));
  readonly current = computed(() => lineAt(this.lines(), this.time()));
  readonly progress = computed(() => lineProgress(this.lines()[this.current()], this.time())); // [2026-10-23]: marcador de karaoke dentro del verso
  readonly avatar = computed<AvatarState>(() => (this.state() === 'singing' ? 'singing' : 'idle'));
  readonly timed = computed(() => this.lines().some((l) => l.start != null)); // Sin tiempos no hay resaltado por audio
  private audio: HTMLAudioElement | null = null;

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
    el.onpause = () => this.state.set(el.ended || el.currentTime === 0 ? 'stopped' : 'paused');
    el.onended = () => {
      this.state.set('stopped');
      this.lipSync.detach();
    };
  }

  toggle(): void {
    if (!this.audio) return;
    if (this.audio.paused) void this.audio.play().catch(() => this.state.set('stopped'));
    else this.audio.pause();
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
    this.audio?.pause();
    this.lipSync.detach();
  }
}
