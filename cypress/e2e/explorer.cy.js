// Covers test cases #31-32: place search + pin to trip, place detail page shows map + info.
// ExplorerView.vue and PlaceView.vue already have good data-cy coverage (explorer-search,
// vibe-*, place-card, place-link, pin, pin-trip, pin-confirm, place-directions, place-pin,
// place-tab-*) — used throughout below instead of guessing selectors.


// Known app bug (not a test issue): useCampPresence.js's start() can race itself when
// Basecamp loads twice in quick succession (e.g. right after a sign-in redirect), throwing
// "cannot add `presence` callbacks ... after `subscribe()`" as an uncaught rejection. That
// crashes unrelated tests in Cypress by default, so we swallow just this one known error here
// rather than let it mask real failures. Worth a look from whoever owns Basecamp/presence.
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
    // the search is debounced (600ms) — wait for the board to settle rather than a fixed sleep
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
    // .should('be.visible') alone never scrolls a nested scroll container (.cork-scroll) —
    // only Cypress actions do that, not plain assertions — so scroll it into view explicitly first.
    cy.get('.map, .map-fallback', { timeout: 10000 }).scrollIntoView().should('be.visible'); // real map or the "add API key" fallback, either is a valid render
    cy.get('[data-cy="place-directions"]').scrollIntoView().should('be.visible');
    cy.get('[data-cy="place-pin"]').scrollIntoView().should('be.visible');

    cy.get('[data-cy="place-tab-reviews"]').click();
    cy.get('[data-cy="place-tab-reviews"]').should('have.attr', 'aria-selected', 'true');
  });
});
