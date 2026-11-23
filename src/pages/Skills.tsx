import { useMemo, useState } from 'react';
import { PlainLayout } from '../shell/layouts';
import { Button, EmptyState, SectionLabel } from '../components/ui';
import { IconPlus, IconSearch, IconSkill } from '../components/icons';
import {
  SKILL_CATEGORIES,
  createSkill,
  removeSkill,
  setAllEnabled,
  toggleSkill,
  useSkills,
  type Skill,
} from '../state/skills';
import s from './skills.module.css';

/**
 * Skills page (roadmap P0-4): my skills first, official catalog below. The
 * toggles really enable and disable — nothing here is a decorative switch
 * (interaction contract). The catalog content is sample data (see
 * `state/skills.ts`); there is no billing, so nothing is ever "plan-locked".
 */
export function SkillsPage() {
  const state = useSkills();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('全部');
  const [adding, setAdding] = useState(false);

  const needle = query.trim().toLowerCase();
  const match = (skill: Skill) =>
    (needle === '' ||
      skill.name.toLowerCase().includes(needle) ||
      skill.description.toLowerCase().includes(needle)) &&
    (category === '全部' || skill.category === category);

  const mine = useMemo(() => state.skills.filter((x) => x.source === 'mine' && match(x)), [state.skills, needle, category]);
  const official = useMemo(() => state.skills.filter((x) => x.source === 'official' && match(x)), [state.skills, needle, category]);
  const anyEnabled = state.skills.some((x) => x.enabled);

  return (
    <PlainLayout wide>
      <div className={s.page} data-skills-page>
        <header className={s.head}>
          <h1 className={s.title}>技能</h1>
          <span className={s.searchWrap}>
            <IconSearch size={13} />
            <input
              className={s.search}
              placeholder="搜索技能"
              aria-label="搜索技能"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-skill-search
            />
          </span>
          <Button size="sm" onClick={() => setAdding((v) => !v)} data-add-skill>
            <IconPlus size={12} /> 添加技能
          </Button>
        </header>

        {adding ? (
          <AddSkillForm
            onDone={() => setAdding(false)}
            onCreate={(input) => {
              createSkill(input);
              setAdding(false);
            }}
          />
        ) : null}

        <section data-my-skills>
          <SectionLabel>我的技能</SectionLabel>
          {mine.length === 0 ? (
            <EmptyState
              title="尚无我的技能"
              hint="创建你自己的技能来自动化重复工作"
              action={
                <Button size="sm" onClick={() => setAdding(true)} data-add-skill-empty>
                  <IconPlus size={12} /> 添加技能
                </Button>
              }
            />
          ) : (
            <ul className={s.grid}>
              {mine.map((skill) => (
                <SkillCard key={skill.id} skill={skill} mine />
              ))}
            </ul>
          )}
        </section>

        <section data-official-skills>
          <div className={s.sectionHead}>
            <SectionLabel>官方技能</SectionLabel>
            <span className={s.count}>
              {official.length} 个技能
              {anyEnabled ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className={s.link}
                    onClick={() => setAllEnabled(false)}
                    data-skill-disable-all
                  >
                    全部禁用
                  </button>
                </>
              ) : null}
            </span>
          </div>

          <div className={s.cats} role="group" aria-label="分类">
            {(['全部', ...SKILL_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                className={[s.cat, category === cat ? s.catOn : ''].join(' ').trim()}
                aria-pressed={category === cat}
                onClick={() => setCategory(cat)}
                data-skill-cat={cat}
              >
                {cat}
              </button>
            ))}
          </div>

          {official.length === 0 ? (
            <EmptyState title="没有匹配的技能" hint="换个关键词或分类。" />
          ) : (
            <ul className={s.grid}>
              {official.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </PlainLayout>
  );
}

function SkillCard({ skill, mine = false }: { skill: Skill; mine?: boolean }) {
  return (
    <li className={s.card} data-skill-card={skill.id} data-enabled={skill.enabled || undefined}>
      <div className={s.cardTop}>
        <span className={s.cardIcon}>
          <IconSkill size={13} />
        </span>
        <span className={s.cardName}>{skill.name}</span>
        <button
          type="button"
          role="switch"
          aria-checked={skill.enabled}
          aria-label={`${skill.name} 启用`}
          className={[s.switch, skill.enabled ? s.switchOn : ''].join(' ').trim()}
          onClick={() => toggleSkill(skill.id)}
          data-skill-toggle={skill.id}
        >
          <span className={s.knob} />
        </button>
      </div>
      <p className={s.cardDesc}>{skill.description || '—'}</p>
      <div className={s.cardFoot}>
        <span className={s.cardCat}>{skill.category}</span>
        {mine ? (
          <button
            type="button"
            className={s.link}
            onClick={() => removeSkill(skill.id)}
            data-skill-remove={skill.id}
          >
            删除
          </button>
        ) : null}
      </div>
    </li>
  );
}

function AddSkillForm({
  onCreate,
  onDone,
}: {
  onCreate: (input: { name: string; description?: string; category?: string }) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(SKILL_CATEGORIES[0]);
  return (
    <form
      className={s.form}
      data-add-skill-form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate({ name, description, category });
      }}
    >
      <SectionLabel>新技能</SectionLabel>
      <input
        className={s.formInput}
        placeholder="名称"
        aria-label="技能名称"
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-add-skill-name
      />
      <input
        className={s.formInput}
        placeholder="一句话说明它自动化什么"
        aria-label="技能描述"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <select
        className={s.formInput}
        aria-label="分类"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {SKILL_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <div className={s.formActions}>
        <Button size="sm" onClick={onDone} variant="ghost" type="button">
          取消
        </Button>
        <Button size="sm" variant="primary" type="submit" data-add-skill-submit>
          创建
        </Button>
      </div>
    </form>
  );
}
