/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginAsAdmin', () => {
  // Create a test admin session via the test-only login endpoint
  cy.request({
    method: 'POST',
    url: '/api/test/login',
    body: {
      email: 'test-admin@dugoutdesk.ca',
    },
    failOnStatusCode: true,
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('success', true);
    expect(response.body).to.have.property('user');
    expect(response.body.user).to.have.property('isAdmin', true);
    cy.log('Successfully logged in as test admin');
  });
});

export {};
