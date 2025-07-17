import { Link, useLocation } from 'wouter';
import { Trophy, Home, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FalconLogo = () => (
  <img 
    src="https://forestgladebaseball.com/wp-content/uploads/2022/02/519-FSU-Falcons-e1645479021528.png" 
    alt="Forest Glade Falcons Logo" 
    className="h-12 w-auto"
    onError={(e) => { 
      const target = e.target as HTMLImageElement;
      target.onerror = null; 
      target.src = 'https://placehold.co/100x50/177e0e/ffffff?text=Falcons'; 
    }}
  />
);

interface SimpleNavigationProps {
  tournamentId: string;
  currentPage: 'dashboard' | 'coach' | 'admin';
}

export const SimpleNavigation = ({ tournamentId, currentPage }: SimpleNavigationProps) => {
  const [location] = useLocation();
  
  return (
    <nav className="bg-[var(--falcons-green)] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <FalconLogo />
            <div className="text-white ml-4">
              <h1 className="text-xl font-bold">Tournament Manager</h1>
              <p className="text-sm text-green-200">Forest Glade Falcons</p>
            </div>
          </div>
          
          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href={`/dashboard/${tournamentId}`}>
              <Button 
                variant={currentPage === 'dashboard' ? 'secondary' : 'ghost'}
                size="sm"
                className={`flex items-center text-white hover:text-green-200 ${
                  currentPage === 'dashboard' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            
            <Link href={`/coach-score-input/${tournamentId}`}>
              <Button 
                variant={currentPage === 'coach' ? 'secondary' : 'ghost'}
                size="sm"
                className={`flex items-center text-white hover:text-green-200 ${
                  currentPage === 'coach' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <FileText className="w-4 h-4 mr-2" />
                Score Input
              </Button>
            </Link>
            
            <Link href={`/admin-portal/${tournamentId}`}>
              <Button 
                variant={currentPage === 'admin' ? 'secondary' : 'ghost'}
                size="sm"
                className={`flex items-center text-white hover:text-green-200 ${
                  currentPage === 'admin' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin
              </Button>
            </Link>
          </div>
          
          {/* Mobile Navigation */}
          <div className="md:hidden">
            <select 
              value={location}
              onChange={(e) => window.location.href = e.target.value}
              className="bg-white/10 text-white border-none rounded px-3 py-1 text-sm"
            >
              <option value={`/dashboard/${tournamentId}`}>Dashboard</option>
              <option value={`/coach-score-input/${tournamentId}`}>Score Input</option>
              <option value={`/admin-portal/${tournamentId}`}>Admin</option>
            </select>
          </div>
        </div>
      </div>
    </nav>
  );
};