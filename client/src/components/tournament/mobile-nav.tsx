import type { CSSProperties } from "react";
import { Link, useLocation } from "wouter";
import { Calendar, Trophy, MessageSquare, MapPin, BarChart3, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

interface MobileNavItem {
  label: string;
  icon: typeof Calendar;
  href: string;
  testId: string;
}

interface MobileBottomNavProps {
  tournamentId: string;
  organizationId?: string;
  primaryColor?: string;
  className?: string;
}

export function MobileBottomNav({ 
  tournamentId, 
  organizationId,
  primaryColor,
  className 
}: MobileBottomNavProps) {
  const [location] = useLocation();
  
  const navItems: MobileNavItem[] = [
    {
      label: "Schedule",
      icon: Calendar,
      href: `/tournament/${tournamentId}`,
      testId: "mobile-nav-schedule",
    },
    {
      label: "Standings",
      icon: BarChart3,
      href: `/tournament/${tournamentId}?tab=standings`,
      testId: "mobile-nav-standings",
    },
    {
      label: "Playoffs",
      icon: Zap,
      href: `/tournament/${tournamentId}?tab=playoffs`,
      testId: "mobile-nav-playoffs",
    },
    {
      label: "Fields",
      icon: MapPin,
      href: `/tournament/${tournamentId}?tab=fields`,
      testId: "mobile-nav-fields",
    },
    {
      label: "Chat",
      icon: MessageSquare,
      href: `/tournament/${tournamentId}?chat=open`,
      testId: "mobile-nav-chat",
    },
  ];

  const isActive = (href: string) => {
    const basePath = `/tournament/${tournamentId}`;
    if (href === basePath && location === basePath) return true;
    if (href.includes('?')) {
      const param = href.split('?')[1];
      return location.includes(param);
    }
    return location === href;
  };

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t shadow-lg safe-area-inset-bottom",
        className
      )}
      style={{ 
        '--brand-primary': primaryColor || '#22c55e',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      } as CSSProperties}
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.testId}
              href={item.href}
              onClick={scrollToTop}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full px-1 transition-colors active:scale-95",
                active 
                  ? "text-[var(--brand-primary)]" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={item.testId}
            >
              <Icon 
                className={cn(
                  "h-5 w-5 mb-0.5 transition-all duration-200",
                  active && "stroke-[2.5] scale-110"
                )} 
              />
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

interface AdminMobileNavProps {
  organizationId: string;
  tournamentId?: string;
  primaryColor?: string;
  className?: string;
}

export function AdminMobileNav({ 
  organizationId, 
  tournamentId,
  primaryColor,
  className 
}: AdminMobileNavProps) {
  const [location] = useLocation();
  
  const navItems: MobileNavItem[] = tournamentId ? [
    {
      label: "Dashboard",
      icon: BarChart3,
      href: `/tournament/${tournamentId}/admin`,
      testId: "admin-nav-dashboard",
    },
    {
      label: "Schedule",
      icon: Calendar,
      href: `/tournament/${tournamentId}/admin/schedule`,
      testId: "admin-nav-schedule",
    },
    {
      label: "Teams",
      icon: Trophy,
      href: `/tournament/${tournamentId}/admin/teams`,
      testId: "admin-nav-teams",
    },
    {
      label: "Comms",
      icon: MessageSquare,
      href: `/org/${organizationId}/tournaments/tournament/${tournamentId}?tab=communications`,
      testId: "admin-nav-comms",
    },
  ] : [
    {
      label: "Home",
      icon: BarChart3,
      href: `/org/${organizationId}/admin`,
      testId: "admin-nav-home",
    },
    {
      label: "Tournaments",
      icon: Trophy,
      href: `/org/${organizationId}/admin/tournaments`,
      testId: "admin-nav-tournaments",
    },
    {
      label: "Fields",
      icon: MapPin,
      href: `/org/${organizationId}/admin/diamonds`,
      testId: "admin-nav-fields",
    },
    {
      label: "Comms",
      icon: MessageSquare,
      href: `/org/${organizationId}/communications`,
      testId: "admin-nav-comms",
    },
  ];

  const isActive = (href: string) => location.startsWith(href);

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t shadow-lg",
        className
      )}
      style={{ 
        '--brand-primary': primaryColor || '#22c55e',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      } as CSSProperties}
      data-testid="admin-mobile-nav"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.testId}
              href={item.href}
              onClick={scrollToTop}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full px-1 transition-colors active:scale-95",
                active 
                  ? "text-[var(--brand-primary)]" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={item.testId}
            >
              <Icon 
                className={cn(
                  "h-5 w-5 mb-0.5 transition-all duration-200",
                  active && "stroke-[2.5] scale-110"
                )} 
              />
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
