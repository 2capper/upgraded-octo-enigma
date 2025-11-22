import { driver, DriveStep, Config } from "driver.js";
import "driver.js/dist/driver.css";

// Custom theme overrides for Driver.js
const tourConfig: Config = {
  showProgress: true,
  showButtons: ['next', 'previous', 'close'],
  nextBtnText: 'Next',
  prevBtnText: 'Back',
  doneBtnText: 'Done',
  progressText: '{{current}} of {{total}}',
  allowClose: true,
  overlayClickNext: false,
  popoverClass: 'dugout-desk-tour',
};

// Admin Portal Tour Steps
export const adminPortalTourSteps: DriveStep[] = [
  {
    element: '[data-tour="tournaments-section"]',
    popover: {
      title: 'Welcome to Your Admin Portal!',
      description: 'This is your tournament command center. Let\'s take a quick tour of the key features.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="tournaments-tab"]',
    popover: {
      title: 'Tournaments',
      description: 'View and manage all your tournaments. Create new tournaments, edit schedules, and track progress.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="teams-tab"]',
    popover: {
      title: 'Team Management',
      description: 'Import rosters, manage team information, and sync with PlayOBA for automatic updates.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="booking-tab"]',
    popover: {
      title: 'Diamond Booking',
      description: 'Manage field booking requests from coaches. Set availability, approve requests, and view the calendar.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="sms-tab"]',
    popover: {
      title: 'Communications',
      description: 'Send bulk SMS messages to coaches and coordinators. Keep everyone informed about schedule changes and updates.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="weather-tab"]',
    popover: {
      title: 'Weather Dashboard',
      description: 'Monitor weather conditions and player safety alerts. Get automated forecasts for tournament days.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="reports-tab"]',
    popover: {
      title: 'Reports & Analytics',
      description: 'View diamond utilization, approval metrics, and other insights about your organization.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="settings-tab"]',
    popover: {
      title: 'Settings',
      description: 'Configure organization defaults, manage admins, and customize feature flags for your organization.',
      side: 'bottom',
    },
  },
  {
    popover: {
      title: 'You\'re All Set!',
      description: 'You can restart this tour anytime from the Settings page. Now let\'s build something great!',
    },
  },
];

// Booking Dashboard Tour Steps (for coaches)
export const bookingTourSteps: DriveStep[] = [
  {
    element: '[data-tour="booking-header"]',
    popover: {
      title: 'Welcome to Diamond Booking!',
      description: 'This is where you request practice time and game fields. Let\'s walk through how it works.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="new-request-button"]',
    popover: {
      title: 'Create Booking Requests',
      description: 'Click here to request a diamond for practice or games. Select your preferred date, time, and field.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="booking-calendar"]',
    popover: {
      title: 'Booking Calendar',
      description: 'View all bookings in calendar format. See when fields are available and when your requests are scheduled.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="pending-requests"]',
    popover: {
      title: 'Track Your Requests',
      description: 'Monitor the status of your booking requests. See which are pending, approved, or need changes.',
      side: 'bottom',
    },
  },
  {
    element: '[data-tour="team-selector"]',
    popover: {
      title: 'Select Your Team',
      description: 'Choose which team you\'re booking for. Each team has its own booking quota and schedule.',
      side: 'bottom',
    },
  },
  {
    popover: {
      title: 'Ready to Book!',
      description: 'You can restart this tour from your profile settings. Happy coaching!',
    },
  },
];

// Tour Manager Class
export class TourManager {
  private driverInstance: ReturnType<typeof driver> | null = null;

  startAdminTour() {
    this.driverInstance = driver({
      ...tourConfig,
      steps: adminPortalTourSteps,
      onDestroyStarted: () => {
        // Mark tour as completed
        this.markTourCompleted('admin-portal');
        this.driverInstance?.destroy();
      },
    });
    this.driverInstance.drive();
  }

  startBookingTour() {
    this.driverInstance = driver({
      ...tourConfig,
      steps: bookingTourSteps,
      onDestroyStarted: () => {
        // Mark tour as completed
        this.markTourCompleted('booking-dashboard');
        this.driverInstance?.destroy();
      },
    });
    this.driverInstance.drive();
  }

  private markTourCompleted(tourId: string) {
    const completedTours = this.getCompletedTours();
    if (!completedTours.includes(tourId)) {
      completedTours.push(tourId);
      localStorage.setItem('completed-tours', JSON.stringify(completedTours));
    }
  }

  getCompletedTours(): string[] {
    const stored = localStorage.getItem('completed-tours');
    return stored ? JSON.parse(stored) : [];
  }

  hasTourBeenCompleted(tourId: string): boolean {
    return this.getCompletedTours().includes(tourId);
  }

  resetTour(tourId: string) {
    const completedTours = this.getCompletedTours();
    const filtered = completedTours.filter(id => id !== tourId);
    localStorage.setItem('completed-tours', JSON.stringify(filtered));
  }

  resetAllTours() {
    localStorage.removeItem('completed-tours');
  }
}

// Export singleton instance
export const tourManager = new TourManager();
