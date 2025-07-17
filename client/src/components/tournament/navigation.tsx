import { useState } from 'react';
import { Menu, X, Trophy, Users, Calendar, ListChecks, Medal, Home } from 'lucide-react';

const NestLogo = () => (
  <img 
    src="@assets/519-fsu-falcons.webp" 
    alt="The Nest Logo" 
    className="h-12 w-auto"
    onError={(e) => { 
      const target = e.target as HTMLImageElement;
      target.onerror = null; 
      target.src = 'https://placehold.co/100x50/177e0e/ffffff?text=The+Nest'; 
    }}
  />
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
    <nav className="bg-[var(--falcons-green)] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <NestLogo />
            <div className="text-white ml-4">
              <h1 className="text-xl font-bold">Tournament Manager</h1>
              <p className="text-sm text-green-200">The Nest</p>
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
                  className={`flex items-center text-white hover:text-green-200 transition-colors ${
                    activeTab === item.id ? 'text-green-200' : ''
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
            className="md:hidden text-white hover:text-green-200"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[var(--falcons-dark-green)]">
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
                  className={`flex items-center w-full px-3 py-2 text-white hover:bg-green-700 rounded-md transition-colors ${
                    activeTab === item.id ? 'bg-green-700' : ''
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
