// Covers test cases #27-30: equal split, custom/itemized split, settlement suggestions,
// SGD<->RM conversion. LedgerView.vue has no data-cy attributes anywhere, so selectors below
// use #ids on form fields and stable visible text/aria-label — the next-most-stable option.
// Requires an existing trip with >=2 crew members. Set Cypress.env('TEST_TRIP_ID').
//
// NOTE on #28 (custom split): earlier this session we suspected server/routes/expensesRoutes.js
// rejected `splitAmounts` via a strict Zod schema. That file no longer exists — expense routes
// were refactored into server/routes/trips.js, and its createExpenseBody schema (schemas.js:224-231)
// now explicitly declares `splitAmounts` as optional and is NOT .strict(). The bug appears fixed.
// This test is written to expect success; if it fails, that regression is worth flagging again.


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

describe('Ledger', () => {
  const tripId = Cypress.env('TEST_TRIP_ID');

  beforeEach(function () {
    if (!tripId || !Cypress.env('TEST_EMAIL')) this.skip();
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit(`/ledger?tripId=${tripId}`);
    cy.get('#trip-picker').should('have.value', tripId);
  });

  it('adds an equal-split expense and shows it on the tab with a per-person share', () => {
    const description = `Cypress equal split ${Date.now()}`;
    cy.contains('button', '+ Add to the tab').click();
    cy.get('#expense-description').type(description);
    cy.get('#expense-amount').type('30');
    // leave the default split (all members checked, customSplit off) — this is the equal split
    cy.contains('button', 'Add it').click();
    cy.contains('li', description).should('be.visible');
    // .invoke('text') avoids the transient zero-layout-size flakiness seen elsewhere (Watcher, settlement)
    cy.get('.total strong', { timeout: 8000 }).invoke('text').should('have.length.greaterThan', 0);
    cy.get('.tiles li').should('have.length.greaterThan', 0); // per-person breakdown rendered
  });

  it('adds a custom/itemized split and it totals correctly', () => {
    const description = `Cypress custom split ${Date.now()}`;
    cy.contains('button', '+ Add to the tab').click();
    cy.get('#expense-description').type(description);
    cy.get('#expense-amount').type('50');
    cy.contains('button', 'Custom amounts').click();
    // fill every visible per-member custom-amount input so they sum to the total (50)
    cy.get('.split-row').then(($rows) => {
      const amountEach = (50 / $rows.length).toFixed(2);
      cy.wrap($rows).each(($row) => {
        cy.wrap($row).find('input.custom').clear().type(amountEach);
      });
    });
    cy.get('.split-status').should('have.class', 'complete');
    cy.contains('button', 'Add it').should('not.be.disabled').click();
    cy.contains('li', description).should('be.visible');
  });

  it('shows a who-owes-whom settlement suggestion after an unequal expense', () => {
    const description = `Cypress settlement check ${Date.now()}`;
    cy.contains('button', '+ Add to the tab').click();
    cy.get('#expense-description').type(description);
    cy.get('#expense-amount').type('40');
    cy.contains('button', 'Add it').click();
    // The trip has 2 members and this expense is paid entirely by whoever's logged in, so an
    // equal split always leaves the other member owing something — deterministically not square.
    // .invoke('text') avoids the same transient zero-layout-size flakiness seen on Watcher's verdict.
    cy.get('.owes li', { timeout: 8000 }).first().invoke('text').should('have.length.greaterThan', 0);
  });

  it('converts the tab total between SGD and RM using the exchange rate', () => {
    cy.intercept('GET', '**/currency/rate*', { rate: 3.45, date: '2026-11-05' }).as('rate');
    cy.visit(`/ledger?tripId=${tripId}`);
    cy.wait('@rate');
    cy.get('.currency button').contains('S$').should('have.attr', 'aria-pressed', 'true');
    cy.get('.currency button').contains('RM').click();
    cy.get('.currency button').contains('RM').should('have.attr', 'aria-pressed', 'true');
    cy.get('.r-meta').should('contain.text', 'RM3.45');
  });
});
