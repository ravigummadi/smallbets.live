/**
 * CricketMatchHeader - Cricket-specific theming for IPL match rooms
 *
 * Shows team names with IPL team colors, match context,
 * and cricket-specific terminology.
 */

import type { MatchDetails } from '@/types';

interface CricketMatchHeaderProps {
  matchDetails: MatchDetails;
  status: string;
  eventName?: string | null;
}

// IPL team color mapping
const IPL_TEAM_COLORS: Record<string, string> = {
  'RCB': '#ec1c24',
  'CSK': '#f9cd05',
  'MI': '#004ba0',
  'DC': '#0078bc',
  'RR': '#ea1a85',
  'PBKS': '#ed1b24',
  'KKR': '#3a225d',
  'GT': '#1c1c1c',
  'LSG': '#a72056',
  'SRH': '#ff822a',
  // Full names
  'Royal Challengers': '#ec1c24',
  'Chennai Super Kings': '#f9cd05',
  'Mumbai Indians': '#004ba0',
  'Delhi Capitals': '#0078bc',
  'Rajasthan Royals': '#ea1a85',
  'Punjab Kings': '#ed1b24',
  'Kolkata Knight Riders': '#3a225d',
  'Gujarat Titans': '#1c1c1c',
  'Lucknow Super Giants': '#a72056',
  'Sunrisers Hyderabad': '#ff822a',
};

function getTeamColor(teamName: string): string {
  // Check exact match
  if (IPL_TEAM_COLORS[teamName]) return IPL_TEAM_COLORS[teamName];

  // Check abbreviation match
  const upper = teamName.toUpperCase();
  if (IPL_TEAM_COLORS[upper]) return IPL_TEAM_COLORS[upper];

  // Check if team name contains a known team (longest match first to avoid
  // ambiguity, e.g. "Punjab Kings" should match before "Kings")
  const entries = Object.entries(IPL_TEAM_COLORS).sort(
    ([a], [b]) => b.length - a.length
  );
  for (const [key, color] of entries) {
    if (teamName.toLowerCase().includes(key.toLowerCase())) return color;
  }

  return 'var(--color-primary)';
}

export default function CricketMatchHeader({ matchDetails, status, eventName }: CricketMatchHeaderProps) {
  const team1Color = getTeamColor(matchDetails.team1);
  const team2Color = getTeamColor(matchDetails.team2);

  return (
    <div
      className="card mb-md match-header-cricket"
      style={{
        '--team1-color': team1Color,
        '--team2-color': team2Color,
        borderTop: 'none',
        overflow: 'hidden',
        position: 'relative',
      } as React.CSSProperties}
    >
      {/* Team color gradient bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: `linear-gradient(90deg, ${team1Color}, ${team2Color})`,
      }} />

      {/* Teams display */}
      <div className="team-vs">
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div
            className="team-name"
            style={{ color: team1Color }}
          >
            {matchDetails.team1}
          </div>
        </div>
        <span className="vs-divider">VS</span>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div
            className="team-name"
            style={{ color: team2Color }}
          >
            {matchDetails.team2}
          </div>
        </div>
      </div>

      {/* Match info */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.75rem',
        color: 'var(--color-text-muted)',
      }}>
        {matchDetails.venue && <span>{matchDetails.venue}</span>}
        {matchDetails.matchDateTime && (
          <span>
            {new Date(matchDetails.matchDateTime).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
        {status === 'active' && (
          <span className="badge-live" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>
            LIVE
          </span>
        )}
      </div>

      {eventName && (
        <div style={{
          textAlign: 'center',
          fontSize: '0.7rem',
          color: 'var(--color-text-muted)',
          marginTop: '0.25rem',
        }}>
          {eventName}
        </div>
      )}
    </div>
  );
}
