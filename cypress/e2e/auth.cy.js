// Covers test cases #1-3 from the team test plan: sign up, sign in, sign out.
// NOTE: uses Cypress.env('TEST_EMAIL')/('TEST_PASSWORD') for an existing account on #2/#3 —
// set these in cypress.env.json (gitignored) or as CYPRESS_TEST_EMAIL/CYPRESS_TEST_PASSWORD env vars.
// No data-cy attributes exist yet on the auth forms; selectors below use type/placeholder,
// which is the next-most-stable option available without touching AuthShell/SignInView markup.


// Known app bug (not a test issue): useCampPresence.js's start() can race itself when
// Basecamp loads twice in quick succession (e.g. right after a sign-in redirect), throwing
// "cannot add `presence` callbacks ... after `subscribe()`" as an uncaught rejection. That
// crashes unrelated tests in Cypress by default, so we swallow just this one known error here
// rather than let it mask real failures. Worth a look from whoever owns Basecamp/presence.
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('presence` callbacks')) return false;
});

describe('Auth', () => {
  it('signs up a new account and lands on Basecamp', () => {
    const email = `cy-${Date.now()}@example.com`;
    cy.visit('/sign-up');
    cy.get('input[type="text"]').eq(0).type('Cypress');
    cy.get('input[type="text"]').eq(1).type('Tester');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').eq(0).type('CypressTest123!');
    cy.get('input[type="password"]').eq(1).type('CypressTest123!'); // confirm password
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
    // Basecamp is a 3D canvas scene (CampScene.vue), not text — "Cypress (you)" is the player
    // label shown above your character, confirming both the sign-up and the right name landed.
    cy.contains('Cypress (you)', { timeout: 10000 }).should('be.visible');
  });

  it('shows an error on sign in with the wrong password', () => {
    cy.visit('/sign-in');
    cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL') || 'nonexistent@example.com');
    cy.get('input[type="password"]').type('definitely-wrong-password');
    cy.get('button[type="submit"]').click();
    cy.get('[role="alert"]').should('be.visible');
    cy.url().should('include', '/sign-in');
  });

  it('signs in, then signs out and loses access to a protected route', () => {
    const email = Cypress.env('TEST_EMAIL');
    const password = Cypress.env('TEST_PASSWORD');
    if (!email || !password) {
      cy.log('Skipping — set CYPRESS_TEST_EMAIL/CYPRESS_TEST_PASSWORD to run this case');
      return;
    }
    cy.visit('/sign-in');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');

    // The account menu button isn't reliably clickable directly on Basecamp's 3D canvas page
    // (it can render covered/off-viewport there) — /planner has the same nav bar, reliably.
    cy.visit('/planner');
    cy.get('[aria-label^="Account menu"]').click();
    cy.contains('[role="menuitem"]', 'Sign out').click();
    cy.url().should('include', '/sign-in');

    cy.visit('/planner');
    cy.url().should('include', '/sign-in');
  });
});
