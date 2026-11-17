describe('Página de inicio (pública)', () => {
  beforeEach(() => cy.visit('/'))

  it('muestra el mensaje principal y los accesos', () => {
    cy.get('h1').should('contain.text', 'Cada proceso con su responsable')
    cy.contains('a', 'Iniciar sesión').should('have.attr', 'href', '/login')
    cy.contains('a', 'Crear cuenta').should('have.attr', 'href', '/registro')
  })

  it('define el título de la página para SEO', () => {
    cy.title().should('include', 'Gestiona procesos')
  })

  it('tiene un enlace para saltar al contenido', () => {
    cy.get('a.skip-link').should('have.attr', 'href', '#contenido')
  })

  it('se ve bien en un teléfono', () => {
    cy.viewport(375, 667)
    cy.get('h1').should('be.visible')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.lte(375))
  })
})
