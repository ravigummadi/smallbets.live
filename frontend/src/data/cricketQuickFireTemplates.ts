/**
 * Cricket quick-fire bet templates for live T20 matches.
 * Host taps a template → auto-fills question and options → hits "Open Bet" → done in 2 taps.
 */

export interface QuickFireTemplate {
  id: string;
  label: string;
  question: string;
  options: string[];
  pointsValue: number;
  timerDuration: number;
}

export const cricketQuickFireTemplates: QuickFireTemplate[] = [
  {
    id: 'toss-winner',
    label: 'Toss Winner',
    question: 'Who will win the toss?',
    options: ['Team A', 'Team B'],
    pointsValue: 100,
    timerDuration: 60,
  },
  {
    id: 'runs-this-over',
    label: 'Runs This Over',
    question: 'Runs in this over?',
    options: ['0-5', '6-10', '11-15', '16+'],
    pointsValue: 100,
    timerDuration: 30,
  },
  {
    id: 'next-wicket-method',
    label: 'Wicket Method',
    question: 'Next wicket method?',
    options: ['Caught', 'Bowled', 'LBW', 'Run Out', 'Other'],
    pointsValue: 100,
    timerDuration: 45,
  },
  {
    id: 'six-this-over',
    label: 'Six This Over?',
    question: 'Will there be a six this over?',
    options: ['Yes', 'No'],
    pointsValue: 100,
    timerDuration: 30,
  },
  {
    id: 'next-ball-outcome',
    label: 'Next Ball',
    question: 'Next ball outcome?',
    options: ['Dot', 'Single', 'Boundary', 'Six', 'Wicket', 'Other'],
    pointsValue: 100,
    timerDuration: 20,
  },
  {
    id: 'match-winner',
    label: 'Match Winner',
    question: 'Who will win the match?',
    options: ['Team A', 'Team B'],
    pointsValue: 100,
    timerDuration: 60,
  },
  {
    id: 'top-scorer',
    label: 'Top Scorer',
    question: 'Top scorer this innings?',
    options: ['Player 1', 'Player 2', 'Player 3', 'Other'],
    pointsValue: 100,
    timerDuration: 60,
  },
  {
    id: 'boundary-this-over',
    label: 'Boundary?',
    question: 'Will there be a boundary this over?',
    options: ['Yes', 'No'],
    pointsValue: 100,
    timerDuration: 30,
  },
  {
    id: 'wicket-this-over',
    label: 'Wicket?',
    question: 'Will there be a wicket this over?',
    options: ['Yes', 'No'],
    pointsValue: 100,
    timerDuration: 30,
  },
  {
    id: 'powerplay-runs',
    label: 'Powerplay Runs',
    question: 'Total runs in the powerplay?',
    options: ['Under 40', '40-50', '51-60', '60+'],
    pointsValue: 100,
    timerDuration: 60,
  },
];
