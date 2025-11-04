export const DashboardHeader = () => {
  return (
    <div className="mb-8">
      <div className="bg-white shadow-lg p-6 border border-[var(--card-border)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h2 className="text-3xl font-bold text-[var(--splash-dark-gray)] uppercase tracking-wide" style={{ fontFamily: 'Oswald' }}>Tournament Series</h2>
            <p className="text-[var(--text-secondary)] mt-1" style={{ fontFamily: 'Roboto' }}>Select a tournament to view details and standings</p>
          </div>
        </div>
      </div>
    </div>
  );
};
