import { computed, Injectable, signal } from '@angular/core';
import { lineAt, type TranscriptLine } from './transcript-line.model';
// [CurrentLineService · Sprint 9.7 · RF-119/RF-124]: calcula la línea actual con el tiempo del audio o la fija con los eventos de voz (turno que habla el avatar) y guarda si la vista sigue la línea | [Patrón]: State (línea actual) + Observer (signals) | [Principio]: SRP (la vista solo pinta) | [Paradigma]: Reactivo
// [Ámbito]: se provee por componente (cada transcripción su propio estado) — no es `root`

@Injectable()
export class CurrentLineService {
  readonly lines = signal<readonly TranscriptLine[]>([]);
  readonly time = signal(0); // Segundo actual del audio
  private readonly pinned = signal<number | null>(null); // Línea fijada por evento de voz (sin tiempos)
  readonly follow = signal(true); // El usuario puede desactivar el desplazamiento automático
  // `computed`: la fijada manda; si no, la que corresponde al tiempo
  readonly current = computed(() => this.pinned() ?? lineAt(this.lines(), this.time()));

  setTime(t: number): void {
    this.pinned.set(null);
    this.time.set(t);
  }

  setIndex(i: number | null): void {
    this.pinned.set(i);
  }
}
