// All fake data lives here. UI-only: state lives in useState / context.
// TODO: replace with API — swap each export for a fetch call later.

export type AppointmentStatus = 'Confirmed' | 'Pending' | 'Completed' | 'Canceled';

export interface Appointment {
  id: string;
  title: string;
  month: string;
  day: string;
  weekday: string;
  time: string;
  mode: string;
  location: string;
  status: AppointmentStatus;
}

// TODO: replace with API
export const student = {
  name: 'Maria Santos',
  firstName: 'Maria',
  initial: 'M',
  alias: 'Blue Heron 24',
};

// TODO: replace with API
export const appointments: Appointment[] = [
  {
    id: 'a1',
    title: 'Academic counseling',
    month: 'OCT',
    day: '13',
    weekday: 'Tue',
    time: '2:00 PM',
    mode: 'Face-to-face',
    location: 'Guidance Office',
    status: 'Confirmed',
  },
  {
    id: 'a2',
    title: 'Personal check-in',
    month: 'OCT',
    day: '21',
    weekday: 'Tue',
    time: '10:00 AM',
    mode: 'Online',
    location: 'Google Meet',
    status: 'Pending',
  },
  {
    id: 'a3',
    title: 'Follow-up session',
    month: 'SEP',
    day: '28',
    weekday: 'Sun',
    time: '9:00 AM',
    mode: 'Phone call',
    location: 'Phone',
    status: 'Completed',
  },
];

// TODO: replace with API
export const events = [
  {
    id: 'e1',
    month: 'OCT',
    day: '20',
    title: 'Wellness talk: Managing exam stress',
    time: '1:00 PM · AVR Hall',
  },
];

// TODO: replace with API
export const concerns = ['Academic', 'Personal', 'Financial', 'Social', 'Family', 'Other'] as const;
export type Concern = (typeof concerns)[number];

// TODO: replace with API
export const meetModes = [
  { id: 'inperson', title: 'In person', helper: 'Meet at the Guidance Office, Main Campus.' },
  { id: 'phone', title: 'Phone call', helper: 'A counselor will call you at your chosen time.' },
  { id: 'online', title: 'Online', helper: 'Video link is sent before your session.' },
] as const;
export type MeetModeId = (typeof meetModes)[number]['id'];

// TODO: replace with API
export const days = [
  { id: 'd12', weekday: 'Mon', day: '12' },
  { id: 'd13', weekday: 'Tue', day: '13' },
  { id: 'd14', weekday: 'Wed', day: '14' },
  { id: 'd15', weekday: 'Thu', day: '15' },
  { id: 'd16', weekday: 'Fri', day: '16' },
] as const;

// TODO: replace with API
export const timeSlots = [
  { id: 't1', label: '9:00 AM', disabled: false },
  { id: 't2', label: '10:30 AM', disabled: false },
  { id: 't3', label: '1:00 PM', disabled: true },
  { id: 't4', label: '2:00 PM', disabled: false },
  { id: 't5', label: '3:30 PM', disabled: false },
  { id: 't6', label: '4:30 PM', disabled: false },
] as const;

// TODO: replace with API — official PSS-10 question stems
export const pssQuestions: string[] = [
  'been upset because of something that happened unexpectedly?',
  'felt that you were unable to control the important things in your life?',
  'felt nervous and stressed?',
  'felt confident about your ability to handle your personal problems?',
  'felt that things were going your way?',
  'found that you could not cope with all the things that you had to do?',
  'been able to control irritations in your life?',
  'felt that you were on top of things?',
  'been angered because of things that happened that were outside of your control?',
  'felt difficulties were piling up so high that you could not overcome them?',
];

// Items 4, 5, 7, 8 (1-indexed) are reverse-scored.
export const pssReverseIndexes: number[] = [3, 4, 6, 7];

// TODO: replace with API
export const pssLabels: string[] = ['Never', 'Almost never', 'Sometimes', 'Fairly often', 'Very often'];

// TODO: replace with API
export const counselorReplies: string[] = [
  'Thank you for sharing that. I am here to listen.',
  'That makes sense. Can you tell me a little more?',
  'You are doing the right thing by reaching out.',
  'Let us take this one step at a time together.',
];

// TODO: replace with API
export const quickReplies: string[] = ['Thank you', 'I need to talk now', 'Reschedule'];

export const stats = { upcoming: 2, completed: 5, checkins: 3 };
