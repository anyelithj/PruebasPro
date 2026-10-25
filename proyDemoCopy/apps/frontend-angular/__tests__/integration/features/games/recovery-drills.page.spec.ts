import { play, startFails } from '@testing/games';
import RecoveryDrillsPage from '@features/games/presentation/pages/recovery-drills.page';
// [Spec RecoveryDrillsPage · Fase 8]: preparar → Empezar → contenido del juego; y error del backend visible al empezar | [Herramienta]: render() + msw (utilidad común @testing/games)

describe('RecoveryDrillsPage', () => {
  it('al empezar muestra el juego «Recuperación rápida»', async () => {
    const r = await play(RecoveryDrillsPage, 'recovery_drills', 'Recuperación rápida', {});
    expect(r.el.textContent).toContain('1 / 3');
    expect(r.el.querySelector('[role="timer"]')).not.toBeNull();
  });

  it('si el backend rechaza la partida, se ve la alerta y se puede reintentar', async () => {
    await startFails(RecoveryDrillsPage);
  });
});
