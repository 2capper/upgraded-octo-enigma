import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { BookingCalendar } from '@/components/booking/booking-calendar';
import { Loader2 } from 'lucide-react';

export function BookingCalendarPage() {
  const { orgId } = useParams<{ orgId: string }>();

  const { data: organization, isLoading } = useQuery({
    queryKey: [`/api/organizations/by-id/${orgId}`],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Organization Not Found</h1>
          <p className="text-muted-foreground mt-2">
            Unable to load organization details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <BookingCalendar organizationId={orgId!} isCoachView={true} />
    </div>
  );
}
