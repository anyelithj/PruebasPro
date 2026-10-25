import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ForumsFacade } from '../../application/forums.facade';
import { canModerate, canRemove, type Post, type Thread, type ThreadInput, type Viewer } from '../../domain/models/forums';
import { ForumPostFormComponent } from '../components/forum-post-form.component';
import { ForumThreadFormComponent } from '../components/forum-thread-form.component';
import { PostListComponent } from '../components/post-list.component';
// [ThreadsPage · Presentación]: /foros/leccion/:lessonId (hilos de la lección + abrir hilo) y /foros/hilo/:id (hilo, respuestas, responder y moderar) | [Patrón]: Container + Máquina de estados (dos vistas, una página) | [Principio]: SRP + DIP (fachada) + DRY (componentes presentacionales compartidos) | [Paradigma]: Declarativo + Reactivo
// [A11y]: estados fijado/cerrado con texto (no solo color), errores en role="alert", acciones con nombre · [Responsive]: una columna, botones que se envuelven en móvil

@Component({
  selector: 'aula-threads-page',
  imports: [
    BackLinkComponent,RouterLink, CardPageTemplate, BadgeComponent, ButtonComponent, SpinnerComponent, ForumThreadFormComponent, ForumPostFormComponent, PostListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().forums;
    @if (facade.actionError(); as err) {
      <p role="alert" class="mt-4 text-sm text-tone-danger">{{ err }}</p>
    }
    @if (lessonId()) {
      <!-- ───── Vista: hilos de la lección ───── -->
      @switch (facade.lesson.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <aula-card-page [heading]="t.title">
            <p role="alert" class="text-sm text-tone-danger">{{ facade.lesson.error() }}</p>
          </aula-card-page>
        }
        @case ('success') {
          @let data = facade.lesson.data()!;
          <aula-card-page [heading]="i18n.fmt(t.lessonTitle, { lesson: data.lesson.title })" [subtitle]="t.subtitle">
            <a aulaBackLink pageBack [href]="'/courses/' + data.lesson.courseId + '/path/' + data.lesson.id">{{ t.backToLesson }}</a>
            <ul class="mb-6 divide-y divide-border rounded-xl border border-border">
              @for (th of data.items; track th.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div class="min-w-0">
                    <a class="font-semibold text-primary hover:underline" [routerLink]="['/foros/hilo', th.id]">{{ th.title }}</a>
                    <p class="text-xs text-muted-foreground">{{ th.authorName }} · {{ i18n.fmt(t.replies, { n: th.postsCount }) }} · <time [attr.datetime]="th.lastPostAt">{{ date(th.lastPostAt) }}</time></p>
                  </div>
                  <div class="flex gap-1">
                    @if (th.pinned) {
                      <aula-badge tone="brand">{{ t.pinned }}</aula-badge>
                    }
                    @if (th.status === 'closed') {
                      <aula-badge>{{ t.closed }}</aula-badge>
                    }
                  </div>
                </li>
              } @empty {
                <li class="p-6 text-center text-sm text-muted-foreground">{{ t.noThreads }}</li>
              }
            </ul>
            <aula-forum-thread-form [t]="t" [busy]="facade.busy()" (submitted)="createThread(data.lesson.id, $event)" />
          </aula-card-page>
        }
      }
    } @else {
      <!-- ───── Vista: hilo con respuestas ───── -->
      @switch (facade.thread.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <aula-card-page [heading]="t.title">
            <p role="alert" class="text-sm text-tone-danger">{{ facade.thread.error() }}</p>
          </aula-card-page>
        }
        @case ('success') {
          @let data = facade.thread.data()!;
          @let th = data.thread;
          <aula-card-page [heading]="th.title" [subtitle]="th.authorName + ' · ' + date(th.createdAt)">
            <a aulaBackLink pageBack [routerLink]="['/foros/leccion', th.lessonId]">{{ t.backToThreads }}</a>
            <div class="mb-3 flex flex-wrap items-center gap-2">
              @if (th.pinned) {
                <aula-badge tone="brand">{{ t.pinned }}</aula-badge>
              }
              @if (th.status === 'closed') {
                <aula-badge>{{ t.closed }}</aula-badge>
              }
              @if (canModerate(viewer())) {
                <button aulaButton variant="outline" size="sm" type="button" [loading]="facade.busy()" (click)="facade.moderate(th.id, { pinned: !th.pinned })">{{ th.pinned ? t.unpin : t.pin }}</button>
                <button aulaButton variant="outline" size="sm" type="button" [loading]="facade.busy()" (click)="facade.moderate(th.id, { status: th.status === 'open' ? 'closed' : 'open' })">{{ th.status === 'open' ? t.close : t.reopen }}</button>
              }
              @if (canRemove(viewer(), th)) {
                <button aulaButton variant="ghost" size="sm" type="button" class="text-tone-danger" (click)="removeThread(th)">{{ t.removeThread }}</button>
              }
            </div>
            <p class="mb-6 whitespace-pre-line text-sm">{{ th.body }}</p>
            <h2 class="mb-2 text-base font-bold">{{ i18n.fmt(t.replies, { n: th.postsCount }) }}</h2>
            <aula-post-list [posts]="data.items" [viewer]="viewer()" [t]="t" [busy]="facade.busy()" [date]="date" (edit)="facade.editPost(th.id, $event.id, $event.body)" (remove)="removePost(th.id, $event)" />
            <div class="mt-4">
              @if (th.status === 'open') {
                <aula-forum-post-form [label]="t.reply" [submitLabel]="t.send" [busy]="facade.busy()" (submitted)="facade.reply(th.id, $event)" />
              } @else {
                <p class="text-sm text-muted-foreground">{{ t.closedHint }}</p>
              }
            </div>
          </aula-card-page>
        }
      }
    }
  `,
})
export default class ThreadsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(ForumsFacade);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly lessonId = input<string>(); // /foros/leccion/:lessonId
  readonly id = input<string>(); // /foros/hilo/:id
  protected readonly viewer = computed<Viewer>(() => ({ id: this.session.user()?.id ?? '', role: this.session.role() }));
  protected readonly canModerate = canModerate;
  protected readonly canRemove = canRemove;
  protected readonly date = (iso: string) => new Date(iso).toLocaleString(this.i18n.intl());

  constructor() {
    // `effect`: cambiar de ruta (lección ↔ hilo) carga la vista que toca
    effect(() => {
      const lesson = this.lessonId();
      const thread = this.id();
      if (lesson) void this.facade.loadLesson(lesson);
      else if (thread) void this.facade.loadThread(thread);
    });
  }

  protected async createThread(lessonId: string, input: ThreadInput): Promise<void> {
    await this.facade.createThread(lessonId, input);
  }

  // `confirm` (DOM): confirmación nativa antes de retirar
  protected async removeThread(th: Thread): Promise<void> {
    if (!confirm(this.i18n.fmt(this.i18n.t().forums.confirmRemove, { title: th.title }))) return;
    if (await this.facade.removeThread(th.id)) await this.router.navigate(['/foros/leccion', th.lessonId]);
  }

  protected removePost(threadId: string, p: Post): void {
    if (confirm(this.i18n.t().forums.confirmRemovePost)) void this.facade.removePost(threadId, p.id);
  }
}
