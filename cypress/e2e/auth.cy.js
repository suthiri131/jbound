// covering sign up, sign in with wrong password, sign out and access revocation

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
    cy.get('input[type="password"]').eq(1).type('CypressTest123!');
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
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

    cy.visit('/planner');
    cy.get('[aria-label^="Account menu"]').click();
    cy.contains('[role="menuitem"]', 'Sign out').click();
    cy.url().should('include', '/sign-in');

    cy.visit('/planner');
    cy.url().should('include', '/sign-in');
  });
});
