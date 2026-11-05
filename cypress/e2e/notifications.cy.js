// covering the notification bell, desktop popup vs mobile page, and the activity feed

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

describe('Notifications', () => {
  beforeEach(function () {
    if (!Cypress.env('TEST_EMAIL')) this.skip();
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
  });

  it('opens a popup panel on desktop width', () => {
    cy.viewport(1280, 900);
    cy.visit('/planner');
    cy.get('.satchel:not(.sound)').first().click();
    cy.get('aside.drawer[aria-label="Notifications"]').should('be.visible');
    cy.url().should('not.include', '/notifications');
  });

  it('navigates to a full page on mobile width', () => {
    cy.viewport(375, 812);
    cy.visit('/planner');
    cy.get('.satchel:not(.sound)').first().click();
    cy.url().should('include', '/notifications');
  });

  it('shows items in the notifications list', () => {
    // The old generic "system messages" feed was replaced by NotificationsList.vue,
    // which shows two kinds of items: pending invites and photo reminders
    // (data-cy="memory-reminder" on each reminder row). Either counts as "has content".
    cy.visit('/notifications');
    cy.get('.pile-list li', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });
});
