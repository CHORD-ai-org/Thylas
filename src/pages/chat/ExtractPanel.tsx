import { useMemo, useState } from 'react';
import { listNotes } from '../../state/notes';
import { extractCandidates, type ExtractSource } from '../../lib/artifact-extract';
import {
  candidatesView,
  commitCandidates,
  loadCandidates,
  reviewCandidate,
  resetCandidates,
  useArtifactCandidates,
} from '../../state/artifactCandidates';
import { Button, SectionLabel } from '../../components/ui';
import s from './chat.module.css';

/**
 * Artifact extraction & review (roadmap P0-5..P0-8): Source → Evidence →
 * Candidate → review → commit. A real structured surface reached from the
 * conversation — an Action Invocation, not a simulated model turn. The
 * extractor is offline and the candidates are local prototype state; nothing
 * here claims a server pipeline or a model's reasoning.
 */

function useSources(): ExtractSource[] {
  return useMemo(
    () => listNotes().map((n) => ({ id: n.id, name: n.title, body: n.body })),
    [],
  );
}

export function ExtractPanel({ onClose }: { onClose: () => void }) {
  useArtifactCandidates();
  const sources = useSources();
  const [picked, setPicked] = useState<string[]>([]);
  const [phase, setPhase] = useState<'pick' | 'review' | 'done'>('pick');
  const state = candidatesView();
  const [editing, setEditing] = useState<string | null>(null);
  const [committedNote, setCommittedNote] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const runExtract = () => {
    const chosen = sources.filter((src) => picked.includes(src.id));
    if (chosen.length === 0) return;
    loadCandidates(chosen.map((c) => c.name), extractCandidates(chosen));
    setPhase('review');
    setCommittedNote(null);
  };

  const commit = () => {
    const { committed, skipped } = commitCandidates();
    setCommittedNote(
      `Committed ${committed} artifact${committed === 1 ? '' : 's'}${skipped ? ` · ${skipped} already committed` : ''}.`,
    );
    setPhase('done');
  };

  return (
    <div className={s.extractPanel} data-extract-panel>
      <div className={s.extractHead}>
        <SectionLabel>Extract artifacts</SectionLabel>
        <span className={s.extractMeta}>local extraction · prototype</span>
        <button type="button" className={s.chipX} aria-label="Close extraction" onClick={onClose}>
          ×
        </button>
      </div>

      {phase === 'pick' ? (
        <>
          <p className={s.extractLede}>Pick the sources to mine. Nothing is read automatically.</p>
          <ul className={s.extractSources} data-extract-sources>
            {sources.length === 0 ? (
              <li className={s.popoverNote}>No notes yet — create one first.</li>
            ) : (
              sources.map((src) => (
                <li key={src.id}>
                  <button
                    type="button"
                    className={[s.extractSource, picked.includes(src.id) ? s.extractSourceOn : ''].join(' ').trim()}
                    aria-pressed={picked.includes(src.id)}
                    data-extract-source={src.id}
                    onClick={() => toggle(src.id)}
                  >
                    <span className={s.popoverKind}>Note</span>
                    <span className={s.convTitle}>{src.name}</span>
                    <span className={s.invokeDetail}>{src.body.slice(0, 40)}…</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className={s.extractActions}>
            <span className={s.extractMeta}>{picked.length} selected</span>
            <Button size="sm" onClick={runExtract} disabled={picked.length === 0} data-extract-run>
              Extract candidates
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={s.extractLede} data-extract-count>
            {state.candidates.length} candidate{state.candidates.length === 1 ? '' : 's'} from{' '}
            {state.sourceNames.join(', ') || 'sources'}. Accept, reject, or edit each — only accepted
            ones become artifacts.
          </p>
          <ul className={s.candidateList} data-extract-candidates>
            {state.candidates.map((c) => (
              <li key={c.id} className={s.candidate} data-status={c.status}>
                <div className={s.candidateTop}>
                  <span className={s.popoverKind}>{c.kind}</span>
                  {editing === c.id ? (
                    <input
                      className={s.candidateNameInput}
                      defaultValue={c.editedName ?? c.name}
                      aria-label="Candidate name"
                      data-candidate-name={c.id}
                      onBlur={(e) => reviewCandidate(c.id, { status: 'edited', editedName: e.target.value })}
                    />
                  ) : (
                    <span className={s.candidateName}>{c.editedName ?? c.name}</span>
                  )}
                  <span className={s.candidateStatus}>{c.status}</span>
                </div>
                <p className={s.candidateBody}>{c.editedContent ?? c.content}</p>
                <p className={s.candidateEvidence} title={c.evidence.map((e) => e.span).join(' · ')}>
                  evidence: {c.evidence.map((e) => e.sourceName).join(', ')} · {c.informationType}
                </p>
                <div className={s.candidateActions}>
                  <Button size="sm" variant={c.status === 'accepted' ? 'primary' : 'quiet'} onClick={() => reviewCandidate(c.id, { status: 'accepted' })} data-candidate-accept={c.id}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reviewCandidate(c.id, { status: 'rejected' })} data-candidate-reject={c.id}>
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(editing === c.id ? null : c.id)} data-candidate-edit={c.id}>
                    {editing === c.id ? 'Done' : 'Edit name'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className={s.extractActions}>
            <span className={s.extractMeta} data-extract-accepted>
              {state.candidates.filter((c) => c.status === 'accepted' || c.status === 'edited').length} ready to commit
            </span>
            <Button size="sm" variant="ghost" onClick={() => { resetCandidates(); setPhase('pick'); setCommittedNote(null); }}>
              Start over
            </Button>
            <Button
              size="sm"
              onClick={commit}
              disabled={state.candidates.every((c) => c.status !== 'accepted' && c.status !== 'edited')}
              data-extract-commit
            >
              Commit as artifacts
            </Button>
          </div>
          {committedNote ? (
            <p className={s.extractDone} data-extract-done>
              {committedNote} Provenance: {state.sourceNames.join(', ')}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
