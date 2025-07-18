import { Link, useLocation } from 'wouter';
import { Trophy, Home, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NestLogo = () => (
  <img 
    src="@assets/Flying F.JPG" 
    alt="The Nest Logo" 
    className="h-12 w-auto"
    onError={(e) => { 
      const target = e.target as HTMLImageElement;
      target.onerror = null; 
      target.src = 'https://placehold.co/100x50/177e0e/ffffff?text=The+Nest'; 
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
    <nav className="bg-[var(--splash-navy)] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <NestLogo />
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