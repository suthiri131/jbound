// covering mobile viewport layout on the Planner and Archives pages

Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('presence` callbacks')) return false;
});

function login(email, password) {
  cy.visit('/sign-in');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('eq', Cypress.config().baseUrl + '/');
}

describe('Responsive layout', () => {
  beforeEach(function () {
    if (!Cypress.env('TEST_EMAIL')) this.skip();
    cy.viewport(375, 812);
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
  });

  it('Planner page fits a mobile viewport', () => {
    cy.visit('/planner');
    cy.document().its('documentElement.scrollWidth').should('be.at.most', 375);
  });

  it('Archives page fits a mobile viewport', () => {
    cy.visit('/archives');
    cy.document().its('documentElement.scrollWidth').should('be.at.most', 375);
  });
});
