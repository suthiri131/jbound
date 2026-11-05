// covering opening an archived trip, auto-archiving, and the attic drawer overflow state

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

describe('Archives — attic drawers', () => {
  it('opens an already-archived trip from its drawer and shows its scrapbook', function () {
    const email = Cypress.env('TEST_EMAIL');
    const tripId = Cypress.env('TEST_ARCHIVED_TRIP_ID');
    if (!email || !tripId) this.skip();

    login(email, Cypress.env('TEST_PASSWORD'));
    cy.visit('/archives');
    cy.get(`.attic [data-trip="${tripId}"]`, { timeout: 10000 }).click();
    cy.url().should('include', `/archives/${tripId}`);
    cy.get('[role="dialog"][aria-modal="true"]').should('be.visible');
  });

  it('auto-archives a trip once the memory-box window has passed (#22)', function () {
    const email = Cypress.env('TEST_EMAIL');
    const tripId = Cypress.env('TEST_DUE_TO_ARCHIVE_TRIP_ID');
    if (!email || !tripId) this.skip();

    login(email, Cypress.env('TEST_PASSWORD'));
    cy.visit('/archives');
    cy.get(`.attic [data-trip="${tripId}"]`, { timeout: 10000 }).should('exist');
  });

  it('shows the "tent is full" overflow dialog when all 7 drawers are taken (#24)', function () {
    const email = Cypress.env('TEST_ATTIC_FULL_EMAIL');
    if (!email) this.skip();

    login(email, Cypress.env('TEST_ATTIC_FULL_PASSWORD'));
    cy.visit('/archives');
    cy.get('[role="alertdialog"]', { timeout: 10000 }).within(() => {
      cy.contains('The tent is full.').should('be.visible');
      cy.contains('button', 'Discard it').should('be.visible');
      cy.contains('button', 'Swap with a drawer').should('be.visible');
    });
  });
});
