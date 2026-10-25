// [FakeEventSource]: doble de EventSource para jsdom (no lo implementa) — las pruebas emiten eventos SSE a mano | [Patrón]: Test Double (Fake) + Registry (`instances`) | [Principio]: KISS

export class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = []; // Conexiones abiertas (las specs buscan la suya por URL)
  closed = false;

  constructor(
    readonly url: string,
    readonly init?: EventSourceInit,
  ) {
    super();
    FakeEventSource.instances.push(this);
  }

  // [emit]: simula `event: <type>\ndata: <json>` del servidor
  emit(type: string, data: unknown, id = ''): void {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data), lastEventId: id }));
  }

  close(): void {
    this.closed = true;
    FakeEventSource.instances = FakeEventSource.instances.filter((s) => s !== this);
  }

  // [last]: última conexión abierta a una URL que contiene `fragment`
  static last(fragment: string): FakeEventSource {
    const found = [...FakeEventSource.instances].reverse().find((s) => s.url.includes(fragment));
    if (!found) throw new Error(`Sin EventSource abierto hacia ${fragment}`);
    return found;
  }
}
