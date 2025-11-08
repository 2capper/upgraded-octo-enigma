import { useQuery } from '@tanstack/react-query';
import { BookingCalendar } from '@/components/booking/booking-calendar';
import { Loader2 } from 'lucide-react';
import type { Organization } from '@shared/schema';

export function AdminBookingCalendarPage() {
  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const forestGlade = organizations?.find(org => org.slug === 'forest-glade');

  if (!forestGlade) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Organization Not Found</h1>
          <p className="text-muted-foreground mt-2">
            Forest Glade organization is not configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <BookingCalendar organizationId={forestGlade.id} isCoachView={false} />
    </div>
  );
}
