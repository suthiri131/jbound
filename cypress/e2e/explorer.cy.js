// covering place search, pinning a place to a trip, and the place detail page

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

describe('Explorer', () => {
  beforeEach(function () {
    if (!Cypress.env('TEST_EMAIL')) this.skip();
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
  });

  it('searches for a place and can pin a result to a trip', () => {
    cy.visit('/explorer?vibes=eating');
    cy.get('[data-cy="explorer-search"]').type('food');
    cy.get('[data-cy="place-card"]', { timeout: 10000 }).should('have.length.greaterThan', 0);

    cy.get('[data-cy="place-card"]').first().within(() => {
      cy.get('[data-cy="pin"]').click();
    });
    cy.get('[role="dialog"][aria-labelledby="pin-title"]').should('be.visible');
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="pin-trip"] option').length > 0) {
        cy.get('[data-cy="pin-confirm"]').click();
        cy.get('[role="dialog"]').should('not.exist');
      } else {
        cy.contains('No trips to pin to yet').should('be.visible');
      }
    });
  });

  it('opens a place detail page showing a map and info', () => {
    cy.visit('/explorer?vibes=eating');
    cy.get('[data-cy="place-link"]', { timeout: 10000 }).first().click();
    cy.url().should('include', '/explorer/place/');
    cy.get('[data-cy="place-tab-overview"]').should('have.attr', 'aria-selected', 'true');
    cy.get('.map, .map-fallback', { timeout: 10000 }).scrollIntoView().should('be.visible');
    cy.get('[data-cy="place-directions"]').scrollIntoView().should('be.visible');
    cy.get('[data-cy="place-pin"]').scrollIntoView().should('be.visible');

    cy.get('[data-cy="place-tab-reviews"]').click();
    cy.get('[data-cy="place-tab-reviews"]').should('have.attr', 'aria-selected', 'true');
  });
});
