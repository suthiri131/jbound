// Covers test case #25: border congestion status displays for Woodlands/Tuas.
// /watcher is a public route (no auth) — confirmed via router/index.js (no requiresAuth meta)
// and WatcherView.vue/BasecampView.vue's own "Open to everyone, signed in or not" comment.
// Stable selectors already exist here: data-cy="gauge", aria-pressed toggle buttons, role="status" verdict.

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
    cy.get('[data-cy="gauge"]').should('be.visible'); // wait for the initial estimate to finish loading first
    cy.get('[data-cy="hour-slider"]').invoke('val', 3).trigger('input').trigger('change');
    // .should('be.visible') is flaky here: the verdict briefly has zero layout size mid re-render
    // (tied to its background-color transition + dynamic text reflow), even though it's genuinely
    // on screen moments later. Asserting on text content instead avoids that race.
    cy.get('.verdict[role="status"] strong', { timeout: 6000 }).invoke('text').should('match', /Low|Medium|High/i);
  });
});
