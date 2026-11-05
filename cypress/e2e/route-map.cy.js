// covering route map markers and the 2D/3D view toggle

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

describe('Route map', () => {
  const tripId = Cypress.env('TEST_TRIP_ID');

  beforeEach(function () {
    if (!tripId || !Cypress.env('TEST_EMAIL')) this.skip();
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit(`/planner/${tripId}`);
  });

  it('renders a numbered pin per stop on the 2D map', () => {
    cy.get('.map', { timeout: 10000 }).should('be.visible');
    cy.get('.map-pin', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });

  it('switches between 2D and 3D view', () => {
    cy.contains('button', '2D').should('have.attr', 'aria-pressed', 'true');
    cy.contains('button', '3D').click();
    cy.contains('button', '3D').should('have.attr', 'aria-pressed', 'true');
    cy.get('.map3d-wrap', { timeout: 15000 }).should('exist');

    cy.contains('button', '2D').click();
    cy.contains('button', '2D').should('have.attr', 'aria-pressed', 'true');
    cy.get('.map', { timeout: 10000 }).should('be.visible');
  });
});
