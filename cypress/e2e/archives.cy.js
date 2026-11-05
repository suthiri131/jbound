// Covers test cases #22-24: auto-archive after the memory-box window, filing an archived trip
// into an attic drawer, and the "all 7 drawers full" overflow flow.
//
// #22 and #24 are date/state-dependent server-side conditions (tripPhase() in memoryWindow.js
// auto-archives a trip once MEMORY_WINDOW_DAYS=7 have passed its end_date; the "tent full" state
// needs all 7 of a user's attic_slot values already taken, per the attic_drawers migration).
// Neither is realistically creatable through the UI inside a test run — trip creation doesn't
// allow backdating a trip 8+ days into the past, and filling 7 drawers requires 7 already-archived
// trips. Like the cron notification feature, this logic is a better fit for a backend integration
// test (call tripPhase()/the archives controller directly with a controlled date) than Cypress.
// Below, these two cases run only against a pre-seeded account/trip supplied via env vars, and
// skip otherwise — the happy-path "open a drawer" case (#23's non-full-tent half) works normally.


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

describe('Archives — attic drawers', () => {
  it('opens an already-archived trip from its drawer and shows its scrapbook', function () {
    const email = Cypress.env('TEST_EMAIL');
    const tripId = Cypress.env('TEST_ARCHIVED_TRIP_ID'); // a trip already in this account's attic
    if (!email || !tripId) this.skip();

    login(email, Cypress.env('TEST_PASSWORD'));
    cy.visit('/archives');
    cy.get(`.attic [data-trip="${tripId}"]`, { timeout: 10000 }).click();
    cy.url().should('include', `/archives/${tripId}`);
    cy.get('[role="dialog"][aria-modal="true"]').should('be.visible');
  });

  it('auto-archives a trip once the memory-box window has passed (#22)', function () {
    // Requires a seeded trip whose end_date is already >7 days in the past and not yet archived —
    // not creatable via the UI. Better suited to a backend integration test calling tripPhase()
    // directly with a mocked date; see server/tests/ for the existing node --test pattern.
    const email = Cypress.env('TEST_EMAIL');
    const tripId = Cypress.env('TEST_DUE_TO_ARCHIVE_TRIP_ID');
    if (!email || !tripId) this.skip();

    login(email, Cypress.env('TEST_PASSWORD'));
    cy.visit('/archives'); // withPhase() lazily archives on load, per tripsController.js
    cy.get(`.attic [data-trip="${tripId}"]`, { timeout: 10000 }).should('exist');
  });

  it('shows the "tent is full" overflow dialog when all 7 drawers are taken (#24)', function () {
    // Requires a seeded account with 7 filled attic_slot values (0-6) plus one more trip
    // freshly archived into attic.pending — not creatable via the UI inside a test run.
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
