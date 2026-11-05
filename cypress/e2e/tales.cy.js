// covering posting a tale and viewing existing postcards

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

describe('Tales', () => {
  beforeEach(function () {
    if (!Cypress.env('TEST_EMAIL')) this.skip();
    login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/tales');
  });

  it('posts a new tale and it appears in the feed', () => {
    const caption = 'Great chicken rice near the Causeway';

    cy.get('.send[aria-expanded]').click();
    cy.get('[data-cy="tale-caption"]').type(caption);
    cy.get('[data-cy="tale-post"]').click();

    cy.get('[data-cy="tale"]').first().as('newTale');
    cy.get('@newTale').find('.postcard.flip').click();
    cy.get('@newTale').find('.pc-story').should('contain.text', caption);
  });

  it('shows existing postcards on load', () => {
    cy.get('[data-cy="tale"]', { timeout: 8000 }).should('have.length.greaterThan', 0);
  });
});
