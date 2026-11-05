// covering editing the camp character and deleting an account

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

describe('Profile', () => {
  it('edits the camp character and saves', () => {
    if (!Cypress.env('TEST_EMAIL')) return;
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/profile');

    cy.contains('button', 'Surprise me').click();
    cy.contains('button', 'Save character').click();
    cy.get('p.status[role="status"]').should('contain.text', 'Saved');
  });

  it('deletes a disposable account and lands on the account-deleted page', () => {
    const email = `cy-delete-${Date.now()}@example.com`;
    const password = 'CypressDeleteMe123!';

    cy.visit('/sign-up');
    cy.get('input[type="text"]').eq(0).type('Cypress');
    cy.get('input[type="text"]').eq(1).type('Deleter');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').eq(0).type(password);
    cy.get('input[type="password"]').eq(1).type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');

    cy.visit('/profile');
    cy.contains('button', 'Delete account').click();
    cy.get('#delete-account-password').type(password);
    cy.contains('button', 'Delete my account permanently').click();

    cy.url().should('include', '/account-deleted');
    cy.contains('Your account has been deleted').should('be.visible');
  });
});
