import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { USER } from '../data/mock';
import { Button, EmptyState, Field } from '../components/ui';
import { PlainLayout } from '../shell/layouts';
import s from './account.module.css';

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'plan', label: 'Plan & billing' },
  { id: 'usage', label: 'Usage & quota' },
  { id: 'keys', label: 'API keys' },
  { id: 'preferences', label: 'Preferences' },
] as const;

export function AccountPage() {
  const { section = 'profile' } = useParams();
  const [notice, setNotice] = useState<string | null>(null);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const setRows = (value: 'comfortable' | 'compact') => {
    setDensity(value);
    document.documentElement.style.setProperty('--h-row', value === 'compact' ? '26px' : '32px');
  };

  return (
    <PlainLayout wide>
      <header className={s.head}>
        <h1 className={s.title}>Account</h1>
        <p className={s.sub}>
          Person-level settings. Organization administration is not here: a member does not see it,
          and this account is a member of one organization.
        </p>
      </header>

      <div className={s.layout}>
        <nav className={s.nav} aria-label="Account sections">
          {SECTIONS.map((item) => (
            <NavLink
              key={item.id}
              to={routes.account(item.id)}
              className={({ isActive }) => [s.navItem, isActive ? s.navOn : ''].join(' ')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={s.content}>
          {notice ? (
            <p className={s.notice} role="status">
              {notice}
            </p>
          ) : null}

          {section === 'profile' ? (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Profile</h2>
              <p className={s.sectionSub}>Identity comes from the CHORD identity provider; Thylas holds only a session.</p>
              <div className={s.fields}>
                <Field label="Name">{USER.name}</Field>
                <Field label="Email">{USER.email}</Field>
                <Field label="Role">{USER.role}</Field>
                <Field label="Member since">2026</Field>
              </div>
            </section>
          ) : null}

          {section === 'plan' ? (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Plan & billing</h2>
              <p className={s.sectionSub}>Invoices, payment methods and tax live with the billing provider. Thylas links out.</p>
              <div className={s.planCard}>
                <div>
                  <p className={s.planName}>{USER.plan}</p>
                  <p className={s.planMeta}>500 credits / month · 10 GB storage · 2 workspaces</p>
                </div>
                <Button size="sm" onClick={() => setNotice('Plan changes happen at the billing provider; no provider is connected in this build.')}>
                  Manage plan
                </Button>
              </div>
            </section>
          ) : null}

          {section === 'usage' ? (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Usage & quota</h2>
              <p className={s.sectionSub}>
                Numbers are displayed as the metering service returns them. Thylas warns; it never
                blocks. A refusal to run comes from the service, with its own reason.
              </p>
              <div className={s.meters}>
                {[
                  { label: 'Credits this month', used: 42, total: 500, unit: 'credits', reset: 'Resets 1 Dec' },
                  { label: 'Storage', used: 3.1, total: 10, unit: 'GB', reset: 'No reset' },
                ].map((meter) => (
                  <div key={meter.label} className={s.meter}>
                    <div className={s.meterHead}>
                      <span>{meter.label}</span>
                      <span className={s.meterValue}>
                        {meter.used} / {meter.total} {meter.unit}
                      </span>
                    </div>
                    <div className={s.meterTrack}>
                      <span className={s.meterFill} style={{ width: `${(meter.used / meter.total) * 100}%` }} />
                    </div>
                    <p className={s.meterFoot}>{meter.reset}</p>
                  </div>
                ))}
              </div>
              <div className={s.fields}>
                <Field label="Last run">baseline-sweep · 42 credits</Field>
                <Field label="Runs this month">9</Field>
              </div>
            </section>
          ) : null}

          {section === 'keys' ? (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>API keys</h2>
              <p className={s.sectionSub}>A key is shown once, at creation, and never again.</p>
              <EmptyState
                title="No keys"
                hint="Issuing a key needs the key service. Nothing here is stored or displayed twice."
                action={<Button size="sm" onClick={() => setNotice('Key issuance needs the API key service; it is not connected in this build.')}>Create key</Button>}
              />
            </section>
          ) : null}

          {section === 'preferences' ? (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Preferences</h2>
              <p className={s.sectionSub}>Three preferences exist in v1. Dark mode, language packs and themes do not.</p>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Row density</p>
                  <p className={s.prefHint}>Table and list rows. Applies immediately, to this session.</p>
                </div>
                <div className={s.segmented} role="group" aria-label="Row density">
                  {(['comfortable', 'compact'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={[s.segment, density === value ? s.segmentOn : ''].join(' ')}
                      onClick={() => setRows(value)}
                      aria-pressed={density === value}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Theme</p>
                  <p className={s.prefHint}>Paper only. A second palette would double the tone problem.</p>
                </div>
                <span className={s.prefValue}>Light</span>
              </div>

              <div className={s.prefRow}>
                <div>
                  <p className={s.prefLabel}>Language</p>
                  <p className={s.prefHint}>English only in v1; Chinese typography needs its own line heights.</p>
                </div>
                <span className={s.prefValue}>English</span>
              </div>
            </section>
          ) : null}

          {!SECTIONS.some((x) => x.id === section) ? (
            <EmptyState title="No such section" hint="Account has five sections; this is not one of them." />
          ) : null}
        </div>
      </div>
    </PlainLayout>
  );
}
