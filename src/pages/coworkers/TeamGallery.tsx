import { useState } from 'react';
import { COWORKER_TEAMS, teamRoles, type CoworkerTeam } from '../../data/coworkerTeams';
import { IconChevron } from '../../components/icons';
import s from './coworker.module.css';

/**
 * The collective perspective. These are illustrative teams, not configured
 * entities: opening one explains its composition and stops there. No runtime,
 * assignment, scheduling or execution is implied.
 */
function TeamCard({ team, open, onToggle }: { team: CoworkerTeam; open: boolean; onToggle: () => void }) {
  const index = String(COWORKER_TEAMS.indexOf(team) + 1).padStart(2, '0');
  const detailId = `${team.id}-composition`;

  return (
    <li className={s.teamItem}>
      <button
        type="button"
        className={s.teamCard}
        data-team-card={team.id}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className={s.teamCardTop}>
          <span className={s.teamIndex}>{index}</span>
          <span className={s.teamArchetype}>{team.archetype}</span>
        </span>
        <span className={s.teamName}>{team.name}</span>
        <span className={s.teamSubtitle}>{team.subtitle}</span>
        <span className={s.teamPhilosophy}>{team.philosophy}</span>
        <span className={s.teamRoles}>
          {teamRoles(team).map((role) => <span key={role} className={s.teamRole}>{role}</span>)}
        </span>
        <span className={s.teamExplore} data-open={open ? 'true' : 'false'}>
          {open ? 'Hide composition' : 'Explore team'}
          <IconChevron size={13} dir={open ? 'down' : 'right'} />
        </span>
      </button>

      {open ? (
        <div className={s.teamDetail} id={detailId} data-team-detail={team.id}>
          <div className={s.teamFacts}>
            <div>
              <span className={s.teamFactLabel}>Worldview</span>
              <p className={s.teamFactValue}>{team.philosophy}</p>
            </div>
            <div>
              <span className={s.teamFactLabel}>Designed to accomplish</span>
              <p className={s.teamFactValue}>{team.purpose}</p>
            </div>
          </div>
          <ul className={s.memberList}>
            {team.members.map((member) => (
              <li key={`${member.role}-${member.name}`} className={s.memberRow} data-team-member={member.role}>
                <span className={s.memberRole}>{member.role}</span>
                <span className={s.memberName}>{member.name}</span>
                <span className={s.memberWork}>{member.contributes}</span>
              </li>
            ))}
          </ul>
          <p className={s.teamBoundary}>
            Illustrative composition — no Coworkers are assigned and no Team runtime exists.
          </p>
        </div>
      ) : null}
    </li>
  );
}

export function TeamGallery({ query }: { query: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const visible = COWORKER_TEAMS.filter((team) =>
    !q || `${team.name} ${team.subtitle} ${team.archetype} ${team.philosophy}`.toLowerCase().includes(q),
  );

  if (visible.length === 0) {
    return <p className={s.teamEmpty}>No team matches this search.</p>;
  }

  return (
    <ul className={s.teamGrid} data-team-grid>
      {visible.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          open={open === team.id}
          onToggle={() => setOpen((current) => (current === team.id ? null : team.id))}
        />
      ))}
    </ul>
  );
}
