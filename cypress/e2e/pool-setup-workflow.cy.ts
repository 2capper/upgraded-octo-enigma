describe('Pool Assignment E2E Workflow', () => {
  let testData: {
    tournamentId: string;
    divisionId: string;
    team1Id: string;
    team2Id: string;
    poolAId: string;
  };

  beforeEach(() => {
    // 1. Seed a tournament with 2 unassigned teams and 2 pools
    cy.task('seed:tournamentWithTeams').then((data) => {
      testData = data as any;
      cy.loginAsAdmin(); 
    });
  });

  afterEach(() => {
    if (testData?.tournamentId) {
      cy.task('db:deleteTournament', testData.tournamentId);
    }
  });

  it('should allow an admin to drag-and-drop teams and persist the new poolId', () => {
    // 1. Visit the Pool Assignment Page
    cy.visit(`/admin/tournament/${testData.tournamentId}/pools`);
    
    // 2. Setup Aliases
    cy.get(`[data-testid="draggable-team-${testData.team1Id}"]`).as('team1');
    cy.get(`[data-testid="pool-dropzone-${testData.poolAId}"]`).as('poolA');

    // 3. Drag Team 1 into Pool A
    cy.get('@team1').trigger('mousedown', { which: 1 });
    cy.get('@poolA').trigger('mousemove').trigger('mouseup', { force: true });

    // 4. Verify UI update
    cy.contains('Team Updated').should('be.visible');
    cy.get('@poolA').find(`[data-testid="draggable-team-${testData.team1Id}"]`).should('exist');

    // 5. RELOAD (The Critical Step)
    cy.reload();

    // 6. Verify Persistence (Team should still be in Pool A)
    cy.get(`[data-testid="pool-dropzone-${testData.poolAId}"]`)
      .find(`[data-testid="draggable-team-${testData.team1Id}"]`)
      .should('exist');
  });
});
