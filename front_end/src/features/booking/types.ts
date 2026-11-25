// Data for booking an advising appointment.
// There is no backend endpoint for appointments yet; see bookingService.ts.

// The appointment the student is offered on the Book appointment screen.
export type AppointmentOffer = {
  id: string;
  advisorName: string;
  serviceName: string; // e.g. "Academic support"
  durationMinutes: number;
  format: string; // e.g. "Office hours · In person"
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM", 24-hour
  endTime: string; // "HH:MM", 24-hour
  reason: string; // e.g. "Academic advising"
  location: string;
  // True while the app only shows sample appointments (shows the "Demo appointment" note).
  isDemo: boolean;
};

// A booked appointment, shown on Appointment confirmed and on the Schedule.
export type ConfirmedAppointment = {
  id: string;
  advisorName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  location: string;
  isDemo: boolean;
};
