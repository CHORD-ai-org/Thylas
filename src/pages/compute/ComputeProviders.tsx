import { Link, useNavigate } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  CAPABILITY_LABEL,
  INTEGRATION_LABEL,
  PROVIDER_CATEGORY_LABEL,
  PROVIDERS,
  type ProviderCategory,
} from '../../data/compute';
import { providerHealth, resourcesView, useCompute } from '../../state/compute';
import { Badge, Button, Chip } from '../../components/ui';
import { ComputeShell } from './ComputeShell';
import { ProviderMark } from './parts';
import s from './compute.module.css';

const ORDER: ProviderCategory[] = ['local', 'ssh', 'cloud', 'gpu-cloud', 'custom'];

const HEALTH_WORD = {
  connected: 'Connected',
  error: 'Connection error',
  disconnected: 'Disconnected',
  empty: 'No machines yet',
  planned: 'Not implemented',
} as const;

export function ComputeProviders() {
  useCompute();

  const navigate = useNavigate();
  const resources = resourcesView();

  const groups = ORDER.map((category) => ({
    category,
    providers: PROVIDERS.filter((p) => p.category === category),
  })).filter((g) => g.providers.length > 0);

  return (
    <ComputeShell
      sub="One registry, many providers. Each entry declares the fields its connection needs, so a new provider is a row of data rather than a new page."
    >
      <p className={s.registryNote}>
        Two entries are prototype flows and two are planned. Nothing here launches, stops or bills a
        machine; <em>Prototype flow</em> means the form and the health are simulated in this build.
      </p>

      {groups.map((group) => (
        <section key={group.category} className={s.providerGroup} aria-labelledby={`cat-${group.category}`}>
          <h2 className={s.groupTitle} id={`cat-${group.category}`}>
            {PROVIDER_CATEGORY_LABEL[group.category]}
          </h2>
          <ul className={s.providerList}>
            {group.providers.map((provider) => {
              const health = providerHealth(provider);
              const machines = resources.filter((r) => r.providerId === provider.id);
              return (
                <li key={provider.id} className={s.providerRow} data-health={health}>
                  <div className={s.providerIdentity}>
                    <ProviderMark providerId={provider.id} />
                    <div className={s.providerText}>
                      <span className={s.providerTitle}>
                        {provider.name}
                        <Badge>{INTEGRATION_LABEL[provider.integration].toUpperCase()}</Badge>
                      </span>
                      <span className={s.providerBlurb}>{provider.blurb}</span>
                    </div>
                  </div>

                  <div className={s.providerCaps}>
                    {provider.capabilities.length === 0 ? (
                      <span className={s.capNone}>no capabilities declared</span>
                    ) : (
                      provider.capabilities.map((cap) => (
                        <Chip key={cap} tone="plain">
                          {CAPABILITY_LABEL[cap]}
                        </Chip>
                      ))
                    )}
                  </div>

                  <div className={s.providerState}>
                    <span className={s.health} data-health={health}>
                      {HEALTH_WORD[health]}
                    </span>
                    <span className={s.providerMachines}>
                      {machines.length === 0 ? 'no machines' : `${machines.length} machine${machines.length === 1 ? '' : 's'}`}
                    </span>
                  </div>

                  <div className={s.providerActions}>
                    {provider.integration === 'planned' ? (
                      <span className={s.planned}>No flow to open</span>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => navigate(`${routes.computeNewResource()}?provider=${provider.id}`)}
                        >
                          {provider.integration === 'prototype' ? 'Connect account' : 'Add a machine'}
                        </Button>
                        {machines.length > 0 ? (
                          <Link
                            to={`${routes.computeResources()}?provider=${provider.id}`}
                            className={s.linkArrow}
                          >
                            View machines
                          </Link>
                        ) : null}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </ComputeShell>
  );
}
