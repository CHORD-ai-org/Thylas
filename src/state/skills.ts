/**
 * Skills store (roadmap P0-5): a skill is an enableable capability module —
 * "create your own skills to automate repetitive work" (design brief). Local
 * prototype: catalog + enable state in a versioned envelope, same pattern as
 * `state/user.ts`. No server, no billing — a disabled skill is simply off.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'thylas:skills:v1';

export type Skill = {
  id: string;
  name: string;
  description: string;
  category: string;
  source: 'official' | 'mine';
  enabled: boolean;
};

export type SkillsState = {
  version: 1;
  skills: Skill[];
};

export const SKILL_CATEGORIES = ['工程', '研究', '写作', '设计', '运营', '数据'] as const;

/** Sample catalog — illustrative content, not a shipped skill library. */
const SEED_SKILLS: Skill[] = [
  { id: 'sk-weekly-report', name: '周报整理', description: '把本周的对话、提交与笔记整理成一页周报。', category: '写作', source: 'official', enabled: true },
  { id: 'sk-meeting-notes', name: '会议纪要', description: '从会议记录中抽取决议、待办与负责人。', category: '写作', source: 'official', enabled: true },
  { id: 'sk-literature', name: '文献速读', description: '读一篇论文，产出主张、证据与局限三段摘要。', category: '研究', source: 'official', enabled: true },
  { id: 'sk-compare', name: '竞品对比', description: '按同一组维度对比两个产品或方案，输出对照表。', category: '研究', source: 'official', enabled: false },
  { id: 'sk-spec-review', name: '规格评审', description: '检查一份规格的缺口、矛盾与未决问题。', category: '工程', source: 'official', enabled: true },
  { id: 'sk-test-plan', name: '测试用例', description: '从验收标准反推测试用例清单。', category: '工程', source: 'official', enabled: false },
  { id: 'sk-release-note', name: '发布说明', description: '按变更类型生成面向用户的发布说明。', category: '工程', source: 'official', enabled: true },
  { id: 'sk-brand-tone', name: '文案校色', description: '按品牌语气检查一段文案并给出改写。', category: '设计', source: 'official', enabled: false },
  { id: 'sk-outline', name: '版式提纲', description: '把一份内容材料整理成版面提纲与层级。', category: '设计', source: 'official', enabled: false },
  { id: 'sk-content-plan', name: '内容排期', description: '把选题池排成四周内容日历。', category: '运营', source: 'official', enabled: true },
  { id: 'sk-metrics', name: '指标拆解', description: '把一个北极星指标拆成可跟踪的子指标树。', category: '数据', source: 'official', enabled: false },
  { id: 'sk-clean-table', name: '表格清洗', description: '清洗一张表格：去重、补缺、统一格式。', category: '数据', source: 'official', enabled: true },
];

const EMPTY: SkillsState = { version: 1, skills: SEED_SKILLS.map((s) => ({ ...s })) };

function read(): SkillsState {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SkillsState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.skills)) return EMPTY;
    return { version: 1, skills: parsed.skills.filter((s): s is Skill => typeof s?.id === 'string') };
  } catch {
    return EMPTY;
  }
}

let snapshot: SkillsState = read();
const listeners = new Set<() => void>();

function commit(next: SkillsState): void {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota: the session keeps working in memory */
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSkills(): SkillsState {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function skillsView(): Skill[] {
  return snapshot.skills;
}

function setEnabled(id: string, enabled: boolean): void {
  commit({
    ...snapshot,
    skills: snapshot.skills.map((s) => (s.id === id ? { ...s, enabled } : s)),
  });
}

export function toggleSkill(id: string): void {
  const skill = snapshot.skills.find((s) => s.id === id);
  if (skill) setEnabled(id, !skill.enabled);
}

export function setAllEnabled(enabled: boolean): void {
  commit({ ...snapshot, skills: snapshot.skills.map((s) => ({ ...s, enabled })) });
}

export function createSkill(input: { name: string; description?: string; category?: string }): Skill {
  const name = input.name.trim() || 'Untitled skill';
  const skill: Skill = {
    id: `sk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    description: (input.description ?? '').trim().slice(0, 200),
    category: input.category && (SKILL_CATEGORIES as readonly string[]).includes(input.category) ? input.category : '工程',
    source: 'mine',
    enabled: true,
  };
  commit({ ...snapshot, skills: [skill, ...snapshot.skills] });
  return skill;
}

export function removeSkill(id: string): void {
  commit({ ...snapshot, skills: snapshot.skills.filter((s) => s.id !== id) });
}

export function resetSkills(): void {
  commit({ version: 1, skills: SEED_SKILLS.map((s) => ({ ...s })) });
}
