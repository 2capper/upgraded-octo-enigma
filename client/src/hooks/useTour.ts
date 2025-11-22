import { useEffect, useState } from 'react';
import { tourManager } from '@/lib/tours';

export type TourType = 'admin-portal' | 'booking-dashboard';

export function useTour(tourType: TourType) {
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    setIsCompleted(tourManager.hasTourBeenCompleted(tourType));
  }, [tourType]);

  const startTour = () => {
    if (tourType === 'admin-portal') {
      tourManager.startAdminTour();
    } else if (tourType === 'booking-dashboard') {
      tourManager.startBookingTour();
    }
  };

  const resetTour = () => {
    tourManager.resetTour(tourType);
    setIsCompleted(false);
  };

  const resetAllTours = () => {
    tourManager.resetAllTours();
    setIsCompleted(false);
  };

  return {
    isCompleted,
    startTour,
    resetTour,
    resetAllTours,
  };
}
