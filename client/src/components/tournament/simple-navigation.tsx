import { Link, useLocation } from 'wouter';
import { Trophy, Home, FileText, Shield, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import fLogo from '@assets/519-fsu-falcons.webp';

const NestLogo = () => (
  <div className="flex items-center">
    <img 
      src={fLogo} 
      alt="Forest Glade Falcons" 
      className="h-10 w-auto mr-2"
    />
    <span className="text-[var(--forest-green)] font-bold text-lg">The Nest</span>
  </div>
);

interface SimpleNavigationProps {
  tournamentId: string;
  currentPage: 'dashboard' | 'coach' | 'admin';
}

export const SimpleNavigation = ({ tournamentId, currentPage }: SimpleNavigationProps) => {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <NestLogo />
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            <Link href={`/tournament/${tournamentId}`}>
              <Button 
                variant={currentPage === 'dashboard' ? 'secondary' : 'ghost'}
                size="sm"
                className={`${currentPage === 'dashboard' ? 'bg-[var(--forest-green)] text-white font-semibold' : 'text-[var(--forest-green)] hover:bg-[var(--forest-green)] hover:text-white'}`}
              >
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            
            <Link href={`/coach-score-input/${tournamentId}`}>
              <Button 
                variant={currentPage === 'coach' ? 'secondary' : 'ghost'}
                size="sm"
                className={`${currentPage === 'coach' ? 'bg-[var(--forest-green)] text-white font-semibold' : 'text-[var(--forest-green)] hover:bg-[var(--forest-green)] hover:text-white'}`}
              >
                <FileText className="w-4 h-4 mr-2" />
                Score Input
              </Button>
            </Link>
            
            <Link href={`/admin-portal/${tournamentId}`}>
              <Button 
                variant={currentPage === 'admin' ? 'secondary' : 'ghost'}
                size="sm"
                className={`${currentPage === 'admin' ? 'bg-[var(--forest-green)] text-white font-semibold' : 'text-[var(--forest-green)] hover:bg-[var(--forest-green)] hover:text-white'}`}
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin
              </Button>
            </Link>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[var(--forest-green)] hover:bg-[var(--forest-green)]/10"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 bg-white">
            <div className="flex flex-col space-y-2">
              <Link href={`/tournament/${tournamentId}`}>
                <Button
                  variant="ghost"
                  size="lg"
                  className={`w-full justify-start ${currentPage === 'dashboard' ? 'bg-[var(--forest-green)] text-white font-semibold' : 'text-[var(--forest-green)]'}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Home className="w-5 h-5 mr-3" />
                  Dashboard
                </Button>
              </Link>
              
              <Link href={`/coach-score-input/${tournamentId}`}>
                <Button
                  variant="ghost"
                  size="lg"
                  className={`w-full justify-start ${currentPage === 'coach' ? 'bg-[var(--forest-green)] text-white font-semibold' : 'text-[var(--forest-green)]'}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FileText className="w-5 h-5 mr-3" />
                  Score Input
                </Button>
              </Link>
              
              <Link href={`/admin-portal/${tournamentId}`}>
                <Button
                  variant="ghost"
                  size="lg"
                  className={`w-full justify-start ${currentPage === 'admin' ? 'bg-[var(--forest-green)] text-white font-semibold' : 'text-[var(--forest-green)]'}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Shield className="w-5 h-5 mr-3" />
                  Admin
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};