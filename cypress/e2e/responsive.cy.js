// Covers test case #35: core pages stay within an iPhone-width viewport (no horizontal scroll).
// Generic page-level check, not component-specific — same pattern the old (broken) map.cy.js
// used just for the map canvas, applied here to the whole document on each page.
// Both /planner and /archives are auth-guarded (redirect to /sign-in otherwise, see auth.cy.js),
// so this needs a signed-in session to actually test the intended pages rather than the sign-in page.


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
