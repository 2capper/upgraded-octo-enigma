import { Fragment } from "react";
import { Link } from "wouter";
import { ChevronRight, Home, Trophy, Building2, Calendar } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbConfig {
  label: string;
  href?: string;
  icon?: "home" | "organization" | "tournament" | "calendar";
}

interface SmartBreadcrumbsProps {
  items: BreadcrumbConfig[];
  className?: string;
}

const iconMap = {
  home: Home,
  organization: Building2,
  tournament: Trophy,
  calendar: Calendar,
};

export function SmartBreadcrumbs({ items, className }: SmartBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <Breadcrumb className={className} data-testid="breadcrumb-nav">
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon ? iconMap[item.icon] : null;

          if (isLast) {
            return (
              <BreadcrumbItem key={index}>
                <BreadcrumbPage className="flex items-center gap-1.5 font-medium" data-testid="breadcrumb-current">
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  <span className="truncate max-w-[200px]">{item.label}</span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            );
          }

          return (
            <Fragment key={index}>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link 
                    href={item.href || '#'} 
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    data-testid={`breadcrumb-link-${index}`}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{item.label}</span>
                    {Icon && <span className="sm:hidden">{item.label.length > 15 ? item.label.slice(0, 15) + '...' : item.label}</span>}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

interface TournamentBreadcrumbsProps {
  organizationName?: string;
  organizationSlug?: string;
  tournamentName?: string;
  tournamentId?: string;
  currentPage?: string;
  className?: string;
}

export function TournamentBreadcrumbs({
  organizationName,
  organizationSlug,
  tournamentName,
  tournamentId,
  currentPage,
  className,
}: TournamentBreadcrumbsProps) {
  const items: BreadcrumbConfig[] = [
    { label: "Home", href: "/", icon: "home" },
  ];

  if (organizationName && organizationSlug) {
    items.push({
      label: organizationName,
      href: `/org/${organizationSlug}`,
      icon: "organization",
    });
  }

  if (tournamentName && tournamentId) {
    if (currentPage) {
      items.push({
        label: tournamentName,
        href: `/tournament/${tournamentId}`,
        icon: "tournament",
      });
      items.push({
        label: currentPage,
        icon: "calendar",
      });
    } else {
      items.push({
        label: tournamentName,
        icon: "tournament",
      });
    }
  }

  return <SmartBreadcrumbs items={items} className={className} />;
}
