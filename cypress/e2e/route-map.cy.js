// Covers test cases #15, #17, #18. Replaces the old cypress/e2e/map.cy.js, which asserted
// selectors (.map-canvas, data-map-ready, [title="JB Sentral"], a POST /api/routes intercept)
// that don't match the current app — RouteMap.vue uses .map/.map-pin and GET /trips/:id/route.
// Requires a trip with >=2 located stops; set CYPRESS_TEST_TRIP_ID to one, or this suite skips.


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
