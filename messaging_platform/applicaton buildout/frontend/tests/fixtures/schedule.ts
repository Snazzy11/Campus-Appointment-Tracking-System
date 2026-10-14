import type { Term } from '../../src/features/schedule/calendar';
export const sampleTerm: Term = {
  season: 'Fall', year: 2026, start_date: '2026-08-31', end_date: '2026-12-18',
  courses: [
    { section: '22475064', course: 'CPS 410', title: 'Senior Design I', credits: 3, instructor: 'Kinnicutt, Patrick', delivery: 'Face to Face', meetings: [{ days: [0, 2, 4], start: 600, end: 650, start_date: '2026-08-31', end_date: '2026-12-18', location: 'Pearce Hall 137' }] },
    { section: '22480412', course: 'BIO 213', title: 'Foundations of Ecology', credits: 4, instructor: 'Kourtev, Peter', delivery: 'Face to Face', meetings: [{ days: [0, 2, 4], start: 660, end: 710, start_date: '2026-08-31', end_date: '2026-12-18', location: 'Biosciences Building 1010' }, { days: [2], start: 720, end: 890, start_date: '2026-08-31', end_date: '2026-12-18', location: 'Biosciences Building 2016' }] },
    { section: '22476562', course: 'ITC 465', title: 'Network Administration & Security', credits: 3, instructor: 'Cregger, Norman', delivery: 'Face to Face', meetings: [{ days: [1, 3], start: 570, end: 645, start_date: '2026-09-01', end_date: '2026-12-17', location: 'Pearce Hall 419' }] },
    { section: '22475065', course: 'CPS 450', title: 'Programming Language Concepts', credits: 3, instructor: 'Sun, Qiyu', delivery: 'Face to Face', meetings: [{ days: [1, 3], start: 750, end: 825, start_date: '2026-09-01', end_date: '2026-12-17', location: 'Pearce Hall 424' }] },
    { section: '22481914', course: 'PES 301WI', title: 'Exercise Psychology', credits: 3, instructor: 'Fisher, Kevin', delivery: 'Face to Face', meetings: [{ days: [1, 3], start: 840, end: 915, start_date: '2026-09-01', end_date: '2026-12-17', location: 'Rose Center 102' }] },
    { section: '22481426', course: 'ANT 174WI', title: 'Inequality in the Ancient World', credits: 3, instructor: 'White, Carmen', delivery: 'Online Asynchronous', meetings: [{ days: [], start: null, end: null, start_date: '2026-10-26', end_date: '2026-12-18', location: 'Online' }] },
  ],
};
