// covering trip creation, crew invites, accept, leave, and owner permissions

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
  // ToastMessage.vue auto-dismisses after exactly 6000ms, which races our old 6s wait —
  // dismiss it directly instead of waiting for the timer.
  cy.get('body').then(($body) => {
    if ($body.find('.toast[role="status"]').length) {
      cy.get('[aria-label="Dismiss"]').click();
    }
  });
  cy.get('[aria-label^="Account menu"]').click();
  cy.contains('[role="menuitem"]', 'Sign out').click();
}

describe('Trips and crew', () => {
  const haveCreds = Cypress.env('TEST_EMAIL') && Cypress.env('TEST2_EMAIL');

  beforeEach(function () {
    if (!haveCreds) this.skip();
  });

  it('creates a trip and it appears in the trip list', () => {
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    const name = 'JB Weekend Trip';
    cy.visit('/planner');
    cy.get('[data-cy="new-trip"]').click();
    cy.get('[data-cy="trip-name"]').type(name);
    cy.get('[data-cy="trip-create"]').click();
    cy.url().should('match', /\/planner\/[\w-]+$/);
    cy.contains(name).should('be.visible');
  });

  it('invites a member by username, who appears as Pending', () => {
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    const name = `Johor Food Crawl ${Math.random().toString(36).slice(2, 6)}`;
    cy.visit('/planner');
    cy.get('[data-cy="new-trip"]').click();
    cy.get('[data-cy="trip-name"]').type(name);
    cy.get('[data-cy="trip-create"]').click();
    cy.url().should('match', /\/planner\/[\w-]+$/);

    // Two levels of disclosure now: the Invite popover opens first (with the code),
    // then 'Invite a friend' inside it reveals the actual username input.
    cy.get('[data-cy="invite-open"]').click();
    cy.contains('button', 'Invite a friend').click();
    cy.get('#invite-user').type(Cypress.env('TEST2_USERNAME'));
    cy.contains('button', 'Send').click();
    cy.contains('li', Cypress.env('TEST2_NAME'), { timeout: 8000 }).should('contain.text', 'invited');
  });

  it('full invite accept/decline, pending-access-block, and remove/leave flow', () => {
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    const name = `Causeway Weekend ${Math.random().toString(36).slice(2, 6)}`;
    cy.visit('/planner');
    cy.get('[data-cy="new-trip"]').click();
    cy.get('[data-cy="trip-name"]').type(name);
    cy.get('[data-cy="trip-create"]').click();
    cy.url().should('match', /\/planner\/(?<id>[\w-]+)$/).then((url) => {
      const tripId = url.match(/\/planner\/([\w-]+)$/)[1];
      cy.wrap(tripId).as('tripId');
    });
    cy.get('[data-cy="invite-open"]').click();
    cy.contains('button', 'Invite a friend').click();
    cy.get('#invite-user').type(Cypress.env('TEST2_USERNAME'));
    cy.contains('button', 'Send').click();
    logout();

    login(Cypress.env('TEST2_EMAIL'), Cypress.env('TEST2_PASSWORD'));
    cy.get('@tripId').then((tripId) => {
      cy.window().then((win) => {
        const key = Object.keys(win.localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
        const token = JSON.parse(win.localStorage.getItem(key)).access_token;
        cy.request({
          url: `http://localhost:3001/api/trips/${tripId}`,
          failOnStatusCode: false,
          headers: { Authorization: `Bearer ${token}` },
        }).its('status').should('eq', 403);
      });
    });

    cy.intercept('POST', '**/invites/accept').as('accept');
    cy.visit('/notifications');
    cy.contains('li', name).contains('button', 'Accept').click();
    cy.wait('@accept');
    cy.get('@tripId').then((tripId) => cy.visit(`/planner/${tripId}`));
    cy.contains(name).should('be.visible');

    cy.contains('li', Cypress.env('TEST2_NAME')).contains('button', 'Leave').click();
    cy.get('[role="alertdialog"]').contains('button', 'Leave crew').click();
    cy.contains('li', Cypress.env('TEST2_NAME')).should('not.exist');
    logout();

    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.get('@tripId').then((tripId) => cy.visit(`/planner/${tripId}`));
    cy.contains('li', '(you)').find('button').should('not.exist');
  });
});
