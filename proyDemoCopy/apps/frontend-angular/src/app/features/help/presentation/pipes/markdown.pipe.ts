import { inject, Pipe, type PipeTransform } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import { anchor } from '../../domain/models/help';
// [MarkdownPipe · Presentación]: Markdown del manual → HTML saneado | [Patrón]: Pipe puro (Angular) + Decorator del renderer (encabezados con ancla) | [Principio]: SRP + Seguridad por defecto (DOMPurify antes de confiar) | [Paradigma]: Funcional
// [Tecnología]: marked 18 (instancia propia: no toca la configuración global) + DOMPurify 3 (elimina scripts, on*, javascript:…) · [A11y/UX]: cada `##` lleva id = ancla → las citas del Agente Guía abren la sección exacta

const md = new Marked({ gfm: true });
md.use({
  renderer: {
    // `this.parser.parseInline` (marked): HTML del texto del encabezado · `text` crudo → misma ancla que FastAPI (reindex_manual.anchor)
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${anchor(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

@Pipe({ name: 'aulaMarkdown' })
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(source: string | null | undefined): SafeHtml {
    const html = md.parse(source ?? '', { async: false }); // `async: false` → string (sin extensiones asíncronas)
    // [Confianza]: DOMPurify es el saneador; Angular solo recibe HTML ya limpio (si no, borraría los `id` de los encabezados)
    return this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(html));
  }
}
