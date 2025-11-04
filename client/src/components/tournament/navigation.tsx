import { useState } from 'react';
import { Menu, X, Trophy, Users, Calendar, ListChecks, Medal, Home } from 'lucide-react';

const TournamentLogo = () => (
  <div className="flex items-center justify-center h-12 w-12 bg-[var(--splash-orange)] rounded-md">
    <Trophy className="w-7 h-7 text-white" />
  </div>
);

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'standings', label: 'Standings', icon: ListChecks },
    { id: 'games', label: 'Games', icon: Calendar },
    { id: 'playoffs', label: 'Playoffs', icon: Medal },
    { id: 'teams', label: 'Teams', icon: Users },
  ];

  return (
    <nav className="bg-[var(--splash-navy)] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <TournamentLogo />
            <div className="text-white ml-4">
              <h1 className="text-xl font-bold">DUGOUT DESK</h1>
              <p className="text-sm opacity-80">Your Tournament Command Center</p>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center text-white hover:text-[var(--splash-orange)] transition-colors ${
                    activeTab === item.id ? 'text-[var(--splash-orange)]' : ''
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-white hover:text-[var(--splash-orange)]"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[var(--splash-dark-navy)]">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center w-full px-3 py-2 text-white hover:bg-[var(--splash-orange)]/20 rounded-md transition-colors ${
                    activeTab === item.id ? 'bg-[var(--splash-orange)]/20' : ''
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};
