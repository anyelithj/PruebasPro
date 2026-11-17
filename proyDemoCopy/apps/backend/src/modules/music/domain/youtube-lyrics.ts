// [youtube-lyrics · 2026-11-04]: letra de un vídeo de YouTube SIN descargar su audio → 1) subtítulos del vídeo (los del autor o los automáticos) · 2) la descripción (muchos vídeos musicales traen ahí la letra)
// [Paradigma]: Funcional (funciones puras: HTML/JSON → texto) · la E/S la hace ImportLyricsFromUrlUseCase con el WebPageFetcher
// ponytail: depende del HTML público de YouTube (ytInitialPlayerResponse) → si YouTube lo cambia, se cae al mensaje «pega la letra»; upgrade: API de datos de YouTube con clave

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // 'asr' = subtítulos automáticos
}

// [youtubeVideoId]: watch?v=, youtu.be/, shorts/, embed/, live/, music.youtube.com | null si no es YouTube
export function youtubeVideoId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') return url.pathname.match(/^\/([\w-]{11})/)?.[1] ?? null;
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  return url.searchParams.get('v')?.match(/^[\w-]{11}$/)?.[0] ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] ?? null;
}

// [jsonAfter]: el valor JSON (arreglo, objeto o cadena) que sigue a `"key":` en un HTML | recorre corchetes respetando cadenas
function jsonAfter(html: string, key: string): unknown {
  const at = html.indexOf(`"${key}":`);
  if (at < 0) return null;
  const start = at + key.length + 3;
  const open = html[start];
  if (open !== '[' && open !== '{' && open !== '"') return null;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') {
        inStr = false;
        if (open === '"') return JSON.parse(html.slice(start, i + 1));
      }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[' || c === '{') depth++;
    else if ((c === ']' || c === '}') && --depth === 0) return JSON.parse(html.slice(start, i + 1));
  }
  return null;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn() ?? fallback;
  } catch {
    return fallback;
  }
}

export function captionTracks(html: string): CaptionTrack[] {
  const list = safe(() => jsonAfter(html, 'captionTracks'), null);
  return Array.isArray(list) ? (list as CaptionTrack[]).filter((t) => typeof t?.baseUrl === 'string') : [];
}

// [pickTrack]: del autor en el idioma > automática en el idioma > del autor en otro idioma > la primera
export function pickTrack(tracks: CaptionTrack[], language: string): CaptionTrack | null {
  const lang = language.toLowerCase().split('-')[0];
  const inLang = (t: CaptionTrack) => t.languageCode?.toLowerCase().split('-')[0] === lang;
  return tracks.find((t) => inLang(t) && t.kind !== 'asr') ?? tracks.find(inLang) ?? tracks.find((t) => t.kind !== 'asr') ?? tracks[0] ?? null;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

// [captionsToLyrics]: subtítulos (json3 o XML timedtext) → un verso por línea · sin «[Música]», «♪» ni repeticiones seguidas
export function captionsToLyrics(body: string): string {
  const text = body.trim();
  let lines: string[];
  if (text.startsWith('{')) {
    const data = safe(() => JSON.parse(text) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> }, {});
    lines = (data.events ?? []).map((e) => (e.segs ?? []).map((s) => s.utf8 ?? '').join(''));
  } else {
    lines = [...text.matchAll(/<(?:text|p)\b[^>]*>([\s\S]*?)<\/(?:text|p)>/g)].map((m) => decode(m[1]!.replace(/<[^>]+>/g, '')));
  }
  const out: string[] = [];
  for (const raw of lines.flatMap((l) => l.split('\n'))) {
    const l = raw.replace(/[♪♫]/g, '').replace(/\s+/g, ' ').trim();
    if (!l || /^[[(].*[\])]$/.test(l)) continue; // [Música], (Aplausos)
    if (out[out.length - 1] !== l) out.push(l);
  }
  return out.join('\n');
}

// [CREDITS · 2026-11-10]: «Directed by…», «Produced by…», «Official Video», «Soundtrack Available 2.10.17» → créditos del vídeo, no versos
const CREDITS = /\b(?:directed|produced|producer|director|edited|editor|executive|photography|cinematograph\w*|choreograph\w*|official (?:music |lyric )?video|available|soundtrack|in theaters|motion picture|written by|composed|mixed|mastered|records|dirigido|producido|editado|video oficial|disponible)\b|^for\s|\d{1,2}[./]\d{1,2}[./]\d{2,4}/i;

// [descriptionLyrics]: descripción del vídeo → posible letra (sin enlaces, hashtags ni créditos) | text '' si no parece una letra
export function descriptionLyrics(html: string): { title: string; text: string } {
  const title = String(safe(() => jsonAfter(html, 'title'), '') ?? '');
  const desc = String(safe(() => jsonAfter(html, 'shortDescription'), '') ?? '');
  const lines = desc
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !/https?:\/\/|^#|@|©|℗|subscribe|suscr|follow|instagram|facebook|tiktok|spotify|stream|provided to youtube|auto-generated/i.test(l) && !CREDITS.test(l));
  const verses = lines.filter(Boolean);
  // Letra = al menos 6 versos, casi todos cortos (una descripción normal son pocas frases largas)
  const looksLikeLyrics = verses.length >= 6 && verses.filter((l) => l.length <= 70).length / verses.length >= 0.7;
  return { title, text: looksLikeLyrics ? lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() : '' };
}

// [captionCues · 2026-11-06]: subtítulos (json3 o XML timedtext) → frases CON tiempo (s) | base de la letra sincronizada de los vídeos de YouTube
export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}
export function captionCues(body: string): CaptionCue[] {
  const text = body.trim();
  const clean = (s: string) => s.replace(/[♪♫]/g, '').replace(/\s+/g, ' ').trim();
  let cues: CaptionCue[];
  if (text.startsWith('{')) {
    const data = safe(() => JSON.parse(text) as { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> }, {});
    cues = (data.events ?? []).map((e) => ({
      start: (e.tStartMs ?? 0) / 1000,
      end: ((e.tStartMs ?? 0) + (e.dDurationMs ?? 0)) / 1000,
      text: clean((e.segs ?? []).map((s) => s.utf8 ?? '').join('')),
    }));
  } else {
    // <text start="12.3" dur="2.1"> (s) o <p t="12300" d="2100"> (ms)
    cues = [...text.matchAll(/<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => {
      const attr = (k: string) => Number(new RegExp(`\\b${k}="([\\d.]+)"`).exec(m[2]!)?.[1] ?? NaN);
      const ms = m[1] === 'p';
      const start = ms ? attr('t') / 1000 : attr('start');
      const dur = ms ? attr('d') / 1000 : attr('dur');
      return { start, end: start + (dur || 0), text: clean(decode(m[3]!.replace(/<[^>]+>/g, ''))) };
    });
  }
  return cues.filter((c) => c.text && Number.isFinite(c.start) && !/^[[(].*[\])]$/.test(c.text));
}

// [lrcCues · 2026-11-09]: letra LRC («[00:38.12] verso», varias marcas por línea) → frases con tiempo (s) | fin = inicio de la siguiente | Función pura
export function lrcCues(lrc: string): CaptionCue[] {
  const cues = lrc.split(/\r?\n/).flatMap((line) => {
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    return text ? [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)].map((m) => ({ start: Number(m[1]) * 60 + Number(m[2]), end: 0, text })) : [];
  });
  cues.sort((a, b) => a.start - b.start);
  return cues.map((c, i) => ({ ...c, end: cues[i + 1]?.start ?? c.start + 4 }));
}

// [timeLyricLines · 2026-11-06]: cada verso → inicio del primer subtítulo que comparte con él más palabras, buscando SIEMPRE hacia delante (la letra va en orden)
// fin = inicio del verso siguiente (o fin de su subtítulo) | verso sin parecido → null (se queda con la estimación) | Función pura
// ponytail: coincidencia por palabras compartidas; alineación forzada con el audio si los subtítulos automáticos fallan mucho
const wordsOf = (s: string): string[] => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
export function timeLyricLines(lines: readonly string[], cues: readonly CaptionCue[]): Array<{ start: number; end: number } | null> {
  let from = 0;
  const starts = lines.map((line) => {
    const want = new Set(wordsOf(line));
    if (!want.size) return null;
    let best = -1;
    let bestScore = 0;
    for (let j = from; j < Math.min(cues.length, from + 8); j++) {
      const got = wordsOf(cues[j]!.text);
      const score = got.filter((w) => want.has(w)).length / Math.max(want.size, got.length);
      if (score > bestScore) [best, bestScore] = [j, score];
    }
    if (best < 0 || bestScore < 0.34) return null;
    from = best + 1;
    return best;
  });
  return starts.map((j, i) => {
    if (j === null) return null;
    const next = starts.slice(i + 1).find((k) => k !== null);
    const end = next != null ? cues[next]!.start : cues[j]!.end;
    return { start: cues[j]!.start, end: Math.max(end, cues[j]!.start + 0.5) };
  });
}
