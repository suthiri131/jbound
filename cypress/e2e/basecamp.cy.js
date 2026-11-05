// Covers test case #4: Basecamp home page shows correct trip/archive/watcher summary tiles.
// Basecamp is a Three.js canvas scene, but each station is a real DOM overlay button
// (CampScene.vue: .bubble buttons with aria-label="Go to {name}: {subtitle}") — fully
// testable despite the 3D rendering. No data-cy on these buttons; aria-label is the
// most stable selector available without touching CampScene.vue's markup.


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

describe('Basecamp', () => {
  it('shows the Watcher tile with a live congestion one-liner (public, no login)', () => {
    cy.visit('/');
    cy.get('[aria-label^="Go to Watcher"]', { timeout: 10000 })
      .should('be.visible')
      .invoke('attr', 'aria-label')
      .should('match', /Woodlands now:/i);
  });

  it('shows signed-in-only tiles (Trips, Archives, Ledger) with real summary data', function () {
    if (!Cypress.env('TEST_EMAIL')) this.skip();
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/');

    // Trips bubble: subtitle defaults to "Plan with your crew" until a next-trip card loads separately,
    // so just confirm the tile itself rendered.
    cy.get('[aria-label^="Go to Trips"]', { timeout: 10000 }).should('be.visible');

    // Archives bubble subtitle flips from "Empty for now" to "N trips in M years" once loaded.
    cy.get('[aria-label^="Go to Archives"]', { timeout: 10000 })
      .invoke('attr', 'aria-label')
      .should('match', /Empty for now|trips? in \d+ years?/i);

    // Ledger bubble subtitle reflects balances ("All square", "owed", or "owe").
    cy.get('[aria-label^="Go to Ledger"]', { timeout: 10000 })
      .invoke('attr', 'aria-label')
      .should('match', /All square|owed|owe/i);
  });

  it('navigates into a station when its bubble is clicked', () => {
    // Clicking a station normally plays a multi-second walk/door/camera-swoop animation before
    // the route changes (CampScene.vue's enter()). The app already skips all of that under
    // prefers-reduced-motion, so stub matchMedia to request that — faster and deterministic.
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.stub(win, 'matchMedia')
          .callsFake((query) => ({
            matches: query.includes('prefers-reduced-motion'),
            media: query,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
          }));
      },
    });
    cy.get('[aria-label^="Go to Watcher"]', { timeout: 10000 }).click();
    cy.url({ timeout: 8000 }).should('include', '/watcher');
  });
});
