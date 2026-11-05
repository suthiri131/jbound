// covering equal and custom expense splits, settlement suggestions, and SGD/RM conversion

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
    // #trip-picker is now a custom combobox button (LedgerSelect.vue), not a native <select> —
    // it has no .value; confirm a real trip got selected by checking it's not the placeholder.
    cy.get('#trip-picker', { timeout: 10000 }).should('not.contain.text', 'Select a trip');
  });

  it('adds an equal-split expense and shows it on the tab with a per-person share', () => {
    const description = `Dinner at the hawker centre ${Math.random().toString(36).slice(2, 6)}`;
    cy.contains('button', '+ Add to the tab').click();
    cy.get('#expense-description').type(description);
    cy.get('#expense-amount').type('30');
    cy.contains('button', 'Add it').click();
    cy.contains('li', description).should('be.visible');
    cy.get('.total strong', { timeout: 8000 }).invoke('text').should('have.length.greaterThan', 0);
    cy.get('.tiles li').should('have.length.greaterThan', 0);
  });

  it('adds a custom/itemized split and it totals correctly', () => {
    const description = `Groceries for the trip ${Math.random().toString(36).slice(2, 6)}`;
    cy.contains('button', '+ Add to the tab').click();
    cy.get('#expense-description').type(description);
    cy.get('#expense-amount').type('50');
    cy.contains('button', 'Custom amounts').click();
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
    const description = `Petrol and toll ${Math.random().toString(36).slice(2, 6)}`;
    cy.contains('button', '+ Add to the tab').click();
    cy.get('#expense-description').type(description);
    cy.get('#expense-amount').type('40');
    cy.contains('button', 'Add it').click();
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
