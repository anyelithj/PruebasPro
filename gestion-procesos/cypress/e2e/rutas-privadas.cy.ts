describe('Rutas privadas', () => {
  const privadas = [
    '/app',
    '/app/procesos',
    '/app/tareas',
    '/app/kanban',
    '/app/calendario',
    '/app/reportes',
    '/app/usuarios',
  ]

  privadas.forEach((ruta) => {
    it(`sin sesión, ${ruta} redirige al login`, () => {
      cy.visit(ruta)
      cy.location('pathname').should('eq', '/login')
    })
  })

  it('una ruta que no existe vuelve a la página de inicio', () => {
    cy.visit('/esta-ruta-no-existe')
    cy.location('pathname').should('eq', '/')
  })
})
