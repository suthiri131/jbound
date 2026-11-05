// covering basecamp home tiles and station navigation

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

/** Station labels are hidden-until-hover by default (fresh localStorage); this toggle shows them all. */
function showAllLabels() {
  cy.get('[aria-label="Show all place labels"]', { timeout: 10000 }).click();
}

describe('Basecamp', () => {
  it('shows the Watcher tile with a live congestion one-liner (public, no login)', () => {
    cy.visit('/');
    showAllLabels();
    cy.get('[aria-label^="Go to Watcher"]', { timeout: 10000 })
      .should('be.visible')
      .invoke('attr', 'aria-label')
      .should('match', /Woodlands now:/i);
  });

  it('shows signed-in-only tiles (Trips, Archives, Ledger) with real summary data', function () {
    if (!Cypress.env('TEST_EMAIL')) this.skip();
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/');
    showAllLabels();

    cy.get('[aria-label^="Go to Planner"]', { timeout: 10000 }).should('be.visible');

    cy.get('[aria-label^="Go to Archives"]', { timeout: 10000 })
      .invoke('attr', 'aria-label')
      .should('match', /Empty for now|trips? in \d+ years?/i);

    cy.get('[aria-label^="Go to Ledger"]', { timeout: 10000 })
      .invoke('attr', 'aria-label')
      .should('match', /All square|owed|owe/i);
  });

  it('navigates into a station when its bubble is clicked', () => {
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
    showAllLabels();
    cy.get('[aria-label^="Go to Watcher"]', { timeout: 10000 }).click();
    cy.url({ timeout: 8000 }).should('include', '/watcher');
  });
});
