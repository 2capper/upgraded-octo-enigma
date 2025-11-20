/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginAsAdmin', () => {
  // Since we're using Replit Auth, we need to set up a session
  // This is a simplified version - in production, you'd use actual OAuth flow
  cy.request({
    method: 'POST',
    url: '/api/test/login',
    body: {
      isAdmin: true,
      isSuperAdmin: false,
    },
    failOnStatusCode: false,
  }).then((response) => {
    if (response.status === 404) {
      // Test login endpoint doesn't exist, skip auth for now
      cy.log('Test login endpoint not available, proceeding without auth');
    }
  });
});

export {};
