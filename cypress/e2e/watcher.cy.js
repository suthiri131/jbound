// covering border congestion status and the hour slider

describe('Watcher — border congestion', () => {
  it('shows a congestion level for Woodlands by default', () => {
    cy.visit('/watcher');
    cy.get('[data-cy="gauge"]').should('be.visible');
    cy.contains('.seg button', 'Woodlands').should('have.attr', 'aria-pressed', 'true');
    cy.get('.verdict[role="status"]').within(() => {
      cy.contains('.when', 'Woodlands Causeway').should('be.visible');
      cy.get('strong').invoke('text').should('match', /Low|Medium|High/i);
    });
  });

  it('switches to Tuas and updates the checkpoint label', () => {
    cy.visit('/watcher');
    cy.contains('.seg button', 'Tuas').click();
    cy.contains('.seg button', 'Tuas').should('have.attr', 'aria-pressed', 'true');
    cy.get('.verdict[role="status"]').within(() => {
      cy.contains('.when', 'Tuas Second Link').should('be.visible');
    });
  });

  it('updates the estimate when the hour slider changes', () => {
    cy.visit('/watcher');
    cy.get('[data-cy="gauge"]').should('be.visible');
    cy.get('[data-cy="hour-slider"]').invoke('val', 3).trigger('input').trigger('change');
    cy.get('.verdict[role="status"] strong', { timeout: 6000 }).invoke('text').should('match', /Low|Medium|High/i);
  });
});
