describe('Playoff End-to-End Workflow', () => {
  let testData: {
    tournamentId: string;
    divisionId: string;
    divisionName: string;
  };

  beforeEach(() => {
    // 1. Seed a FULL tournament where pool play is 100% complete and scores are final
    cy.task('seed:fullTournament').then((data) => {
      testData = data as any;
      cy.loginAsAdmin();
    });
  });

  afterEach(() => {
    if (testData?.tournamentId) {
      cy.task('db:deleteTournament', testData.tournamentId);
    }
  });

  it('should allow an admin to set slots, generate a bracket, and view it publicly', () => {
    // --- STEP 1: Schedule Slots (When/Where) ---
    cy.visit(`/admin/tournament/${testData.tournamentId}/playoffs`);
    
    // Select Division
    cy.get('[data-testid="select-age-division"]').click();
    cy.contains(testData.divisionName).click();

    // Schedule Quarterfinal 1
    cy.get('[data-testid="input-r1-g1-date"]').type('2025-07-20');
    cy.get('[data-testid="select-r1-g1-time"]').click();
    cy.contains('09:00').click();
    cy.get('[data-testid="button-save-playoff-schedule"]').click();
    
    // Verify Save
    cy.contains('Playoff Schedule Saved').should('be.visible');

    // --- STEP 2: Generate Bracket (Who) ---
    // Button should be enabled because pool play is complete
    cy.get('[data-testid="button-generate-bracket"]').should('not.be.disabled').click();
    
    // Verify Generation
    cy.contains('Matchups Created!').should('be.visible');

    // --- STEP 3: Verify Public Site ---
    cy.visit(`/tournament/${testData.tournamentId}/playoffs`);
    
    // The game should have the TIME we set in Step 1...
    cy.contains('9:00').should('exist');
    // ...AND the TEAMS generated in Step 2 (e.g., "Pool A #1")
    cy.contains('Pool A #1').should('exist');
  });
});
