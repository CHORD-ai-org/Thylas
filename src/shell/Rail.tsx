import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';
import { workspaces, processesIn } from '../data/selectors';
import type { Workspace } from '../data/types';
import { useApp } from '../state/app';
import { Badge, IconButton } from '../components/ui';
import {
  IconAccount,
  IconBoards,
  IconChevron,
  IconFiles,
  IconNotes,
  IconOverview,
  IconProcesses,
  IconRecently,
  IconSearch,
} from '../components/icons';
import s from './shell.module.css';

function RailItem({
  label,
  path,
  icon,
  active,
  trailing,
  collapsed,
}: {
  label: string;
  path: string;
  icon: React.ReactNode;
  active: boolean;
  trailing?: React.ReactNode;
  collapsed: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={[s.railItem, active ? s.railActive : ''].join(' ')}
      onClick={() => navigate(path)}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <span className={s.railIcon}>{icon}</span>
      {collapsed ? null : <span className={s.railLabel}>{label}</span>}
      {collapsed ? null : trailing}
    </button>
  );
}

function needsYou(ws: Workspace): number {
  return processesIn(ws.id).filter((p) => p.state === 'needs_input').length;
}

export function Rail() {
  const { railCollapsed, toggleRail, openPalette } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string[]>([]);

  const activeWs = workspaces().find((w) => pathname.startsWith(`/w/${w.id}`))?.id ?? null;

  const isOpen = (id: string) => id === activeWs || open.includes(id);

  return (
    <aside className={s.rail} data-collapsed={railCollapsed || undefined}>
      <div className={s.brand}>
        <span className={s.brandMark} aria-hidden>
          τ
        </span>
        {railCollapsed ? null : <span className={s.brandName}>Thylas</span>}
        {railCollapsed ? null : (
          <span className={s.brandActions}>
            <IconButton label="Search or jump to (Ctrl K)" onClick={openPalette}>
              <IconSearch />
            </IconButton>
            <IconButton label="Collapse sidebar" onClick={toggleRail}>
              <IconChevron dir="left" />
            </IconButton>
          </span>
        )}
      </div>

      <nav className={s.railNav} aria-label="Global">
        <RailItem
          label="Overview"
          path={routes.overview()}
          icon={<IconOverview />}
          active={pathname === routes.overview() || pathname === '/'}
          collapsed={railCollapsed}
        />
        <RailItem
          label="Recently"
          path={routes.recently()}
          icon={<IconRecently />}
          active={pathname === routes.recently()}
          collapsed={railCollapsed}
        />
      </nav>

      <div className={s.railSection}>
        {railCollapsed ? (
          <div className={s.railRule} />
        ) : (
          <div className={s.railLabelLine}>
            <span>Workspace</span>
            <span className={s.railCount}>{workspaces().length}</span>
          </div>
        )}

        {workspaces().map((ws) => {
          const expanded = isOpen(ws.id);
          const pending = needsYou(ws);
          return (
            <div key={ws.id} className={s.wsBlock}>
              <button
                type="button"
                className={[s.wsRow, ws.id === activeWs ? s.wsActive : ''].join(' ')}
                onClick={() => {
                  setOpen((v) => (v.includes(ws.id) ? v.filter((x) => x !== ws.id) : [...v, ws.id]));
                  if (!expanded) navigate(routes.files(ws.id));
                }}
                aria-expanded={expanded}
                title={ws.name}
              >
                {railCollapsed ? null : (
                  <span className={s.wsChevron} data-open={expanded || undefined}>
                    <IconChevron dir="right" size={12} />
                  </span>
                )}
                {railCollapsed ? (
                  <span className={s.wsInitial}>{ws.name.slice(0, 1)}</span>
                ) : (
                  <>
                    <span className={s.wsName}>{ws.name}</span>
                    <Badge>{ws.scope === 'org' ? `ORG · ${ws.role?.toUpperCase()}` : 'PERSONAL'}</Badge>
                    {pending > 0 ? <span className={s.wsPending} title={`${pending} need you`} /> : null}
                  </>
                )}
              </button>

              {expanded && !railCollapsed ? (
                <div className={s.rooms}>
                  <RailItem
                    label="Files"
                    path={routes.files(ws.id)}
                    icon={<IconFiles />}
                    active={pathname.startsWith(routes.files(ws.id))}
                    collapsed={false}
                  />
                  <RailItem
                    label="Whiteboard"
                    path={routes.boards(ws.id)}
                    icon={<IconBoards />}
                    active={pathname.startsWith(routes.boards(ws.id))}
                    collapsed={false}
                  />
                  <RailItem
                    label="Processes"
                    path={routes.processes(ws.id)}
                    icon={<IconProcesses />}
                    active={pathname.startsWith(routes.processes(ws.id))}
                    collapsed={false}
                    trailing={pending > 0 ? <span className={s.railDot} title={`${pending} need you`} /> : undefined}
                  />
                </div>
              ) : null}
            </div>
          );
        })}

      </div>

      <nav className={s.railNav} aria-label="Library">
        <RailItem
          label="Notes"
          path={routes.notes()}
          icon={<IconNotes />}
          active={pathname.startsWith('/notes')}
          collapsed={railCollapsed}
        />
        <RailItem
          label="Account"
          path={routes.account()}
          icon={<IconAccount />}
          active={pathname.startsWith('/account')}
          collapsed={railCollapsed}
        />
      </nav>

      <div className={s.railFoot}>
        {railCollapsed ? (
          <IconButton label="Expand sidebar" onClick={toggleRail}>
            <IconChevron dir="right" />
          </IconButton>
        ) : (
          <button type="button" className={s.collapseRow} onClick={toggleRail}>
            <IconChevron dir="left" size={12} />
            Collapse sidebar
          </button>
        )}
        <div className={s.profile} title="Ceaser Zhao · Free plan">
          <span className={s.avatar}>C</span>
          {railCollapsed ? null : (
            <span className={s.profileText}>
              <span className={s.profileName}>Ceaser Zhao</span>
              <span className={s.profileMeta}>Personal · Free</span>
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
