import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { GameAgentFacade } from './application/game-agent.facade';
import { GamesFacade } from './application/games.facade';
import { SpeechFacade } from './application/speech.facade';
import { GamesRepository } from './domain/games.repository.port';
import { GamesHttpRepository } from './infrastructure/games.http-repository';
// [Rutas Games · Sprints 8.8–8.11]: /juegos (hub) y una ruta por juego, escenarios de role-play, progreso de fluidez y resultado — lazy y con sesión | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) + Lazy Loading por pantalla | [Principio]: DIP + OCP (juego nuevo = una línea)
// [Integración]: Next.js reescribe /juegos (ANGULAR_PREFIXES) · los segmentos coinciden con GAME_INFO[tipo].route (SSOT del catálogo)

export const GAMES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [
      { provide: GamesRepository, useClass: GamesHttpRepository },
      GamesFacade,
      GameAgentFacade,
      SpeechFacade,
    ],
    children: [
      {
        path: '',
        title: 'Juegos · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/games-hub.page'),
      },
      // Vocabulario y memoria (8.8)
      {
        path: 'flashcards',
        title: 'Flashcards · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/flashcards.page'),
      },
      {
        path: 'memory',
        title: 'Parejas · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/memory.page'),
      },
      {
        path: 'bingo',
        title: 'Bingo de palabras · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/bingo.page'),
      },
      {
        path: 'clasificar',
        title: 'Clasificación rápida · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/quick-sort.page'),
      },
      {
        path: 'palabra-prohibida',
        title: 'Palabra prohibida · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/forbidden-word.page'),
      },
      // Fluidez contra el agente y role-play (8.9)
      {
        path: 'tabu',
        title: 'Tabú · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/taboo.page'),
      },
      {
        path: '20-preguntas',
        title: '20 preguntas · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/twenty-questions.page'),
      },
      {
        path: 'describe-adivina',
        title: 'Describe y adivina · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/describe-guess.page'),
      },
      {
        path: 'historia',
        title: 'Historia encadenada · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/chained-story.page'),
      },
      {
        path: 'debate',
        title: 'Debate rápido · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/quick-debate.page'),
      },
      {
        path: 'tema',
        title: 'Tema al azar · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/random-topic.page'),
      },
      {
        path: 'speed-speaking',
        title: 'Hablar contra reloj · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/speed-speaking.page'),
      },
      {
        path: 'role-play',
        title: 'Escenarios de role-play · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/scenario-list.page'),
      },
      {
        path: 'role-play/:scenarioId',
        title: 'Role-play · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/role-play.page'),
      },
      // Comprensión y recuperación rápida (8.10)
      {
        path: 'shadowing',
        title: 'Shadowing · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/shadowing.page'),
      },
      {
        path: 'dictado',
        title: 'Dictado parcial · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/partial-dictation.page'),
      },
      {
        path: 'reformula',
        title: 'Escucha y reformula · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/listen-reformulate.page'),
      },
      {
        path: 'pregunta-rapida',
        title: 'Pregunta-respuesta rápida · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/quick-qa.page'),
      },
      {
        path: 'recuperacion',
        title: 'Recuperación rápida · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/recovery-drills.page'),
      },
      // Métricas y resultados (8.11)
      {
        path: 'progreso',
        title: 'Mi fluidez · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/fluency-dashboard.page'),
      },
      {
        path: 'sesion/:id',
        title: 'Resultado de la partida · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/game-result.page'),
      },
    ],
  },
];
