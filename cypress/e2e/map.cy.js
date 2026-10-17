describe('Planner route map', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/routes', (request) => {
      const coordinates = request.body.coordinates;
      request.reply({
        statusCode: 200,
        body: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {
              segments: coordinates.slice(1).map(() => ({ distance: 1200, duration: 540 })),
            },
            geometry: { type: 'LineString', coordinates },
          }],
        },
      });
    }).as('route');
  });

  it('loads the Google Map and numbered stop markers on Planner', () => {
    cy.visit('/planner');
    cy.get('.map-canvas[data-map-ready="true"]').should('be.visible');
    cy.get('.map-canvas .gm-style').should('exist');
    cy.get('.map-canvas .gm-style [title="JB Sentral"]').should('exist');
    cy.get('.planner-layout').should('have.attr', 'data-day', 'day-1');
    cy.get('.map-canvas').should('have.attr', 'data-stop-count', '3');
    cy.wait('@route');
    cy.get('.map-canvas').should('have.attr', 'data-route-rendered', 'true');
    cy.get('.map-canvas').should('have.attr', 'data-leg-label-count', '2');
    cy.get('.map-canvas').should('have.attr', 'data-route-style', 'dashed');
  });

  it('updates the stops and route when switching day tabs', () => {
    cy.visit('/planner');
    cy.wait('@route').then(({ request }) => {
      expect(request.body.coordinates).to.have.length(3);
    });

    cy.contains('[role="tab"]', 'Day 2 · Theme parks').click();
    cy.get('.planner-layout').should('have.attr', 'data-day', 'day-2');
    cy.get('.map-canvas').should('have.attr', 'data-stop-count', '2');
    cy.wait('@route').its('request.body.coordinates').should('deep.equal', [
      [103.6299, 1.4268],
      [103.779, 1.5005],
    ]);
    cy.get('.map-canvas').should('have.attr', 'data-leg-label-count', '1');
    cy.get('.map-canvas').should('have.attr', 'data-route-rendered', 'true');
  });

  it('keeps the map within an iPhone-width viewport', () => {
    cy.viewport(375, 812);
    cy.visit('/planner');
    cy.get('.map-canvas[data-map-ready="true"]').should('be.visible');
    cy.get('.map-canvas').should(($map) => {
      expect($map[0].getBoundingClientRect().width).to.be.at.most(375);
    });
    cy.document().its('documentElement.scrollWidth').should('be.at.most', 375);
  });
});
