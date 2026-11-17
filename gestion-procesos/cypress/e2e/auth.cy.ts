describe('Inicio de sesión y registro (sin conectarse a Firebase)', () => {
  it('login: muestra los errores de los campos vacíos', () => {
    cy.visit('/login')
    cy.contains('button', 'Entrar').click()
    cy.contains('El correo es obligatorio').should('be.visible')
    cy.contains('La contraseña es obligatoria').should('be.visible')
  })

  it('login: valida el formato del correo', () => {
    cy.visit('/login')
    cy.get('#campo-email').type('no-es-un-correo').blur()
    cy.contains('Escribe un correo válido').should('be.visible')
    cy.get('#campo-email').should('have.attr', 'aria-invalid', 'true')
  })

  it('login: ofrece Google y el enlace al registro', () => {
    cy.visit('/login')
    cy.contains('button', 'Continuar con Google').should('be.visible')
    cy.contains('a', 'Regístrate').click()
    cy.location('pathname').should('eq', '/registro')
  })

  it('registro: valida que las contraseñas coincidan', () => {
    cy.visit('/registro')
    cy.get('#campo-name').type('Ana Gómez')
    cy.get('#campo-email').type('ana@empresa.co')
    cy.get('#campo-password').type('secreto1')
    cy.get('#campo-confirm').type('secreto2')
    cy.contains('button', 'Crear cuenta').click()
    cy.contains('Las contraseñas no coinciden').should('be.visible')
  })
})
