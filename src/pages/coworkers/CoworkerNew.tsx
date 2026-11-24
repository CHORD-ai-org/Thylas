import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { defaultMindFramework, mindFrameworkRows } from '../../lib/coworkers';
import { createCoworker } from '../../state/coworkers';
import { createCoworkersClient } from '../../services/coworkers/client';
import { ask } from '../../services/ai/client';
import { useWorkspaces } from '../../state/workspaces';
import { Button } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import a from '../artifacts/artifacts.module.css';

/**
 * Creation (Q-C ruled 2026-11-24 = A): a six-step commissioning wizard is the
 * default path; the flat single page stays as the quick-create channel. Both
 * render the same atoms — one schema, two renderings.
 *
 * Honesty rules kept: no fake controls. "生成草案" really calls the AI endpoint
 * and degrades to a manual form; First Encounter records a task and says so —
 * running it is C4's runtime, not a pretend play button.
 */

const DRAFT_KEY = 'thylas:coworker-draft:v1';
const client = createCoworkersClient();

type Draft = {
  intent: string;
  name: string;
  description: string;
  forWork: string;
  notFor: string;
  output: string;
  wsId: string;
  firstTask: string;
};

const EMPTY_DRAFT: Draft = {
  intent: '',
  name: '',
  description: '',
  forWork: '',
  notFor: '',
  output: '',
  wsId: 'none',
  firstTask: '',
};

const STEPS = ['意图', '身份', '职责', 'Mind & Method', '环境', 'First Encounter'] as const;

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function CoworkerNew() {
  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const [mode, setMode] = useState<'wizard' | 'quick'>('wizard');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [notice, setNotice] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* quota: the session keeps working */
    }
  }, [draft]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const ready = draft.name.trim() !== '' && draft.forWork.trim() !== '';

  const generate = async () => {
    if (draft.intent.trim() === '') return;
    setGenerating(true);
    setNotice('');
    const result = await ask(
      '从下面的描述生成一位 AI 同事的配置草案。只输出 JSON，不要其他文字：' +
        '{"name":"短名","description":"一句话","forWork":"负责什么","notFor":"不负责什么","output":"好的产出长什么样"}' +
        `\n描述：${draft.intent}`,
    );
    setGenerating(false);
    if (!result.ok) {
      setNotice('AI 未配置或生成失败——下面手动填即可。');
      return;
    }
    const text = result.answer.text;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<Draft>;
      set({
        name: typeof parsed.name === 'string' ? parsed.name.slice(0, 60) : draft.name,
        description: typeof parsed.description === 'string' ? parsed.description.slice(0, 200) : draft.description,
        forWork: typeof parsed.forWork === 'string' ? parsed.forWork : draft.forWork,
        notFor: typeof parsed.notFor === 'string' ? parsed.notFor : draft.notFor,
        output: typeof parsed.output === 'string' ? parsed.output : draft.output,
      });
      setNotice('草案已填——每一项都可以改。');
    } catch {
      setNotice('生成结果不是可用的草案——下面手动填即可。');
    }
  };

  const create = async (withTask: boolean) => {
    if (!ready) return;
    const created = createCoworker({
      name: draft.name,
      description: draft.description,
      forWork: draft.forWork,
      notFor: draft.notFor,
      output: draft.output,
      membership: draft.wsId === 'none' ? undefined : { wsId: draft.wsId, role: draft.forWork.trim().slice(0, 60) },
    });
    if (draft.wsId !== 'none') {
      void client.upsertEmployment(created.id, draft.wsId, {
        role: draft.forWork.trim().slice(0, 60),
        grants: [],
      });
    }
    if (withTask && draft.firstTask.trim() !== '') {
      void client.createEvent(created.id, { verb: 'first_encounter', payload: { task: draft.firstTask.trim() } });
    } else {
      void client.createEvent(created.id, { verb: 'first_encounter_skipped' });
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    navigate(routes.coworker(created.id));
  };

  return (
    <PlainLayout size="console">
      <header className={a.head}>
        <div className={a.headText}>
          <p className={a.eyebrow}>
            <Link to={routes.coworkers()} className={a.backLink}>
              Coworkers
            </Link>
            {' / '}
            {mode === 'wizard' ? `New · ${step + 1}/6 ${STEPS[step]}` : 'New · 快速创建'}
          </p>
          <h1 className={a.title}>雇一位同事</h1>
          <p className={a.sub}>
            {mode === 'wizard'
              ? '建立工作关系，不是填表。任何一步退出都保留草稿。'
              : '一次填完，随时回来补。'}
          </p>
        </div>
        <Button size="sm" onClick={() => setMode((m) => (m === 'wizard' ? 'quick' : 'wizard'))} data-create-mode-toggle>
          {mode === 'wizard' ? '快速创建' : '向导创建'}
        </Button>
      </header>

      {notice === '' ? null : <p className={a.formAside} data-create-notice>{notice}</p>}

      <form
        className={a.form}
        data-create-coworker-form
        onSubmit={(e) => {
          e.preventDefault();
          void create(true);
        }}
      >
        {mode === 'wizard' && step === 0 ? (
          <>
            <div className={a.formRow}>
              <span className={a.formLabel}>你想要一个什么样的同事？</span>
              <textarea
                className={a.editorBody}
                aria-label="Intent"
                rows={4}
                value={draft.intent}
                placeholder="例如：帮我做竞品研究，产出对比表，不写代码。"
                onChange={(e) => set({ intent: e.target.value })}
                data-create-intent
              />
            </div>
            <div className={a.formActions}>
              <Button size="sm" onClick={generate} disabled={generating || draft.intent.trim() === ''} data-create-generate>
                {generating ? '生成中…' : '生成草案'}
              </Button>
              <span className={a.formAside}>生成是预填器，每一项都可以改</span>
            </div>
          </>
        ) : null}

        {mode === 'wizard' && step === 1 ? (
          <>
            <div className={a.formRow}>
              <span className={a.formLabel}>Name</span>
              <input
                className={a.input}
                aria-label="Coworker name"
                value={draft.name}
                placeholder="由你定——例如 Mira、评审员、随便什么"
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className={a.formRow}>
              <span className={a.formLabel}>
                Description<span className={a.optional}> · optional</span>
              </span>
              <input
                className={a.input}
                aria-label="Description"
                value={draft.description}
                placeholder="一行别人看得懂的话"
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>
          </>
        ) : null}

        {mode === 'wizard' && step === 2 ? (
          <>
            <div className={a.formRow}>
              <span className={a.formLabel}>Responsible for</span>
              <textarea
                className={a.editorBody}
                aria-label="Responsible for"
                value={draft.forWork}
                rows={3}
                placeholder="负责的领域与任务"
                onChange={(e) => set({ forWork: e.target.value })}
              />
            </div>
            <div className={a.formRow}>
              <span className={a.formLabel}>
                Not responsible for<span className={a.optional}> · optional</span>
              </span>
              <input
                className={a.input}
                aria-label="Not responsible for"
                value={draft.notFor}
                placeholder="显式排除，委派才有诚实的边界"
                onChange={(e) => set({ notFor: e.target.value })}
              />
            </div>
            <div className={a.formRow}>
              <span className={a.formLabel}>
                What good output looks like<span className={a.optional}> · optional</span>
              </span>
              <input
                className={a.input}
                aria-label="What good output looks like"
                value={draft.output}
                placeholder="产出怎么算好"
                onChange={(e) => set({ output: e.target.value })}
              />
            </div>
          </>
        ) : null}

        {mode === 'wizard' && step === 3 ? (
          <div className={a.formRow}>
            <span className={a.formLabel}>Mind & Method</span>
            <div>
              {mindFrameworkRows(defaultMindFramework()).map((row) => (
                <p key={row.label} className={a.formAside}>
                  <strong>{row.label}</strong> — {row.value}
                </p>
              ))}
              <p className={a.formAside}>声明式配置，可后补；此刻不承诺行为差异。</p>
            </div>
          </div>
        ) : null}

        {mode === 'wizard' && step === 4 ? (
          <div className={a.formRow}>
            <span className={a.formLabel}>
              Initial workspace<span className={a.optional}> · optional</span>
            </span>
            <select
              className={a.select}
              aria-label="Initial workspace"
              value={draft.wsId}
              onChange={(e) => set({ wsId: e.target.value })}
            >
              <option value="none">None for now</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <span className={a.formAside}>最小授权默认——入职即名册，工具授权随后按需给</span>
          </div>
        ) : null}

        {mode === 'wizard' && step === 5 ? (
          <>
            <div className={a.formRow}>
              <span className={a.formLabel}>
                First Encounter<span className={a.optional}> · optional</span>
              </span>
              <textarea
                className={a.editorBody}
                aria-label="First task"
                rows={3}
                value={draft.firstTask}
                placeholder="给一个小活，当作第一次实测"
                onChange={(e) => set({ firstTask: e.target.value })}
              />
              <span className={a.formAside}>这里只记录任务；实测运行在协作运行时（C4）落地</span>
            </div>
            <div className={a.formActions}>
              <Button size="sm" variant="primary" type="submit" disabled={!ready} data-create-coworker-submit>
                创建并记录实测
              </Button>
              <Button size="sm" onClick={() => void create(false)} disabled={!ready}>
                跳过实测，创建
              </Button>
            </div>
          </>
        ) : null}

        {mode === 'wizard' ? (
          <div className={a.formActions}>
            <Button size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              上一步
            </Button>
            {step < 5 ? (
              <Button
                size="sm"
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                disabled={step === 1 && draft.name.trim() === ''}
                data-create-next
              >
                下一步
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className={a.formRow}>
              <span className={a.formLabel}>Name</span>
              <input
                className={a.input}
                aria-label="Coworker name"
                value={draft.name}
                placeholder="Protocol Reviewer"
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className={a.formRow}>
              <span className={a.formLabel}>
                Description<span className={a.optional}> · optional</span>
              </span>
              <input
                className={a.input}
                aria-label="Description"
                value={draft.description}
                placeholder="One line someone else can understand"
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>
            <div className={a.formRow}>
              <span className={a.formLabel}>Responsible for</span>
              <textarea
                className={a.editorBody}
                aria-label="Responsible for"
                value={draft.forWork}
                rows={3}
                placeholder="Working domain and tasks."
                onChange={(e) => set({ forWork: e.target.value })}
              />
            </div>
            <div className={a.formRow}>
              <span className={a.formLabel}>
                Not responsible for<span className={a.optional}> · optional</span>
              </span>
              <input
                className={a.input}
                aria-label="Not responsible for"
                value={draft.notFor}
                placeholder="Explicit exclusions, so delegation has honest edges"
                onChange={(e) => set({ notFor: e.target.value })}
              />
            </div>
            <div className={a.formRow}>
              <span className={a.formLabel}>
                What good output looks like<span className={a.optional}> · optional</span>
              </span>
              <input
                className={a.input}
                aria-label="What good output looks like"
                value={draft.output}
                placeholder="How results will be judged"
                onChange={(e) => set({ output: e.target.value })}
              />
            </div>
            <div className={a.formRow}>
              <span className={a.formLabel}>
                Initial workspace<span className={a.optional}> · optional</span>
              </span>
              <select
                className={a.select}
                aria-label="Initial workspace"
                value={draft.wsId}
                onChange={(e) => set({ wsId: e.target.value })}
              >
                <option value="none">None for now</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <span className={a.formAside}>membership grants access — nothing is implied by creating</span>
            </div>
            <div className={a.formActions}>
              <Button size="sm" variant="primary" type="submit" disabled={!ready} data-create-coworker-submit>
                Create coworker
              </Button>
            </div>
          </>
        )}
      </form>
    </PlainLayout>
  );
}
