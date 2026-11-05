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

function logout() {
  cy.get('body').then(($body) => {
    if ($body.find('.toast[role="status"]').length) {
      cy.get('[aria-label="Dismiss"]').click();
    }
  });
  cy.get('[aria-label^="Account menu"]').click();
  cy.contains('[role="menuitem"]', 'Sign out').click();
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

  it('shows items in the notifications list', function () {
    // The old generic "system messages" feed was replaced by NotificationsList.vue, which shows
    // pending invites and photo reminders (data-cy="memory-reminder" on each reminder row).
    // Reminders only show up near a trip's end, so seed a pending invite instead — it's the
    // one notification kind this test can create deterministically on demand.
    if (!Cypress.env('TEST2_EMAIL')) this.skip();
    const name = `Pulai Springs Day Trip ${Math.random().toString(36).slice(2, 6)}`;
    cy.visit('/planner');
    cy.get('[data-cy="new-trip"]').click();
    cy.get('[data-cy="trip-name"]').type(name);
    cy.get('[data-cy="trip-create"]').click();
    cy.get('[data-cy="invite-open"]').click();
    cy.contains('button', 'Invite a friend').click();
    cy.get('#invite-user').type(Cypress.env('TEST2_USERNAME'));
    cy.contains('button', 'Send').click();
    logout();

    login(Cypress.env('TEST2_EMAIL'), Cypress.env('TEST2_PASSWORD'));
    cy.visit('/notifications');
    cy.get('.pile-list li', { timeout: 10000 }).should('have.length.greaterThan', 0);
  });
});
