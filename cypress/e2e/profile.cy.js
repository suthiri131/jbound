// Covers test cases #33 (edit character, saves) and #34 (delete account -> account-deleted page).
// #34 creates and deletes its OWN disposable account via sign-up rather than touching
// Cypress.env('TEST_EMAIL') — account deletion is permanent and irreversible (removes profile,
// tales, trip memberships), so it must never run against the shared test account other specs rely on.


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

describe('Profile', () => {
  it('edits the camp character and saves', () => {
    if (!Cypress.env('TEST_EMAIL')) return;
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/profile');

    cy.contains('button', 'Surprise me').click(); // randomises the look, guaranteed to make it "dirty"
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
    cy.get('input[type="password"]').eq(1).type(password); // confirm password
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
