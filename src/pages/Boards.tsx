import { useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { boardsIn, getBoard, getWorkspace } from '../data/selectors';
import type { Board } from '../data/types';
import { useRegisterTab } from '../state/app';
import { Badge, Button, EmptyState, Field } from '../components/ui';
import { IconChevron, IconPlus } from '../components/icons';
import { WorkspaceLayout } from '../shell/layouts';
import g from '../styles/grammar.module.css';
import {
  CARD_HEADER_CENTER,
  SCENE_H,
  SCENE_W,
  sceneFromBoard,
  sceneVars,
  type BoardScene,
} from './boards/scene';
import { createLocalBoardStore } from './boards/store';
import { useBoardEditor } from './boards/useBoardEditor';
import { useCanvasViewport, type ViewportRefs } from './boards/useViewport';
import s from './boards.module.css';

export function BoardsPage() {
  const { wsId = '' } = useParams();
  const navigate = useNavigate();
  const ws = getWorkspace(wsId);
  const boards = boardsIn(wsId);

  if (!ws) return <EmptyState title="Workspace not found" hint="Recently lists what you can still reach." />;

  return (
    <WorkspaceLayout wsId={wsId}>
      <div className={s.indexPage}>
        <div className={s.indexHead}>
          <div>
            <h1 className={s.indexTitle}>Whiteboard</h1>
            <p className={s.indexSub}>
              Boards in {ws.name}. A board is a place, not a document: the cards reference files and
              notes, they do not copy them.
            </p>
          </div>
          <Button
            size="sm"
            icon={<IconPlus size={12} />}
            disabled
            title="Board creation needs the workspace service"
            aria-describedby="boards-limit"
          >
            New board
          </Button>
        </div>

        <p className={g.limit} id="boards-limit">
          Creating a board needs the workspace service. The boards below are samples.
        </p>

        <div className={s.grid}>
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              className={s.card}
              onClick={() => navigate(routes.board(wsId, board.id))}
            >
              <span className={s.cardPreview} aria-hidden>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={s.cardTile} data-live={i === 2 || undefined} />
                ))}
              </span>
              <span className={s.cardBody}>
                <span className={s.cardName}>{board.name}</span>
                <span className={s.cardMeta}>
                  {board.boardCards.length} cards · updated {board.updated}
                </span>
              </span>
              <IconChevron size={11} />
            </button>
          ))}
          {boards.length === 0 ? (
            <EmptyState title="No boards yet" hint="A board holds cards, sections, and labelled edges inside one workspace." />
          ) : null}
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function BoardDetailPage() {
  const { wsId = '', boardId = '' } = useParams();
  const board = getBoard(boardId);

  useRegisterTab(
    `ws:${wsId}`,
    board ? { type: 'board', label: board.name, path: routes.board(wsId, boardId) } : null,
  );

  if (!board) {
    return <EmptyState title="Board not found" hint="It may have been deleted. The tab stays open so the loss is visible." />;
  }

  // Keyed so switching boards starts from that board's scene instead of
  // carrying the previous card list and undo stack across.
  return <BoardCanvas key={board.id} wsId={wsId} board={board} />;
}

function BoardCanvas({ wsId, board }: { wsId: string; board: Board }) {
  const navigate = useNavigate();
  const areaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const guideXRef = useRef<HTMLDivElement>(null);
  const guideYRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  const refs: ViewportRefs = {
    area: areaRef,
    stage: stageRef,
    scene: sceneRef,
    zoomLabel: zoomLabelRef,
  };
  // Cmd+0 / Cmd++ / Cmd+- are bound to the viewport inside the hook.
  const { zoomIn, zoomOut, view, fitRatio } = useCanvasViewport(refs, true);

  const store = useMemo(() => createLocalBoardStore(window.localStorage), []);
  const initial = useMemo(() => sceneFromBoard(board), [board]);
  const saved = useMemo<BoardScene | null>(() => {
    const result = store.load(board.id);
    return result.ok ? result.scene : null;
  }, [store, board.id]);

  const editor = useBoardEditor({
    initial,
    refs: { scene: sceneRef, guideX: guideXRef, guideY: guideYRef, marquee: marqueeRef },
    view,
    fitRatio,
    store,
    saved,
  });

  const { scene } = editor;
  const selected = editor.selectedCards.length === 1 ? editor.selectedCards[0] : null;
  const multi = editor.selectedCards.length > 1;
  const empty = scene.cards.length === 0;

  const center = (id: string) => {
    const card = scene.cards.find((c) => c.id === id);
    return card ? { x: card.x + card.w / 2, y: card.y + CARD_HEADER_CENTER } : { x: 0, y: 0 };
  };

  const status = multi
    ? `${editor.selectedCards.length} selected`
    : selected
      ? `Selected · ${selected.title.slice(0, 32) || 'Untitled'}`
      : 'No selection';

  return (
    <WorkspaceLayout
      wsId={wsId}
      flush
      panelTitle={selected ? 'Selection' : multi ? 'Selection' : 'This board'}
      panel={
        <div className={s.panelInner}>
          {selected ? (
            <>
              <h3 className={s.panelCardTitle}>{selected.title || 'Untitled card'}</h3>
              <div className={s.panelFields}>
                <Field label="Type">Card · {selected.eyebrow.toLowerCase()}</Field>
                <Field label="Section">
                  {scene.sections.find((x) => x.id === selected.sectionId)?.title ?? 'Unassigned'}
                </Field>
                <Field label="Position">
                  <span className={s.monoValue}>
                    {Math.round(selected.x)}, {Math.round(selected.y)} · {Math.round(selected.w)}w
                  </span>
                </Field>
                <Field label="Refs">{selected.ref ?? '—'}</Field>
              </div>
              {selected.live ? (
                <p className={s.liveNote}>
                  <span className={s.liveDot} /> Live card · binding is read-only. Thylas renders what
                  run {selected.live.runLabel} produced; it does not compute the number.
                </p>
              ) : null}
              <div className={s.panelActions}>
                {selected.ref ? (
                  <Button size="sm" onClick={() => navigate(routes.files(wsId))}>
                    Open reference
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => editor.setEditing(selected.id)}>
                  Rename
                </Button>
                <Button size="sm" variant="ghost" onClick={editor.removeSelected}>
                  Delete
                </Button>
              </div>
              <p className={s.panelHint}>
                Arrow keys move 1px, shift 10px. Backspace deletes. ⌘Z undoes — and clears the
                selection, so the undo is visible rather than silent.
              </p>
            </>
          ) : multi ? (
            <>
              <h3 className={s.panelCardTitle}>{editor.selectedCards.length} cards</h3>
              <div className={s.panelFields}>
                <Field label="Selection">Multiple</Field>
                <Field label="Live results">
                  {editor.selectedCards.filter((c) => c.live).length}
                </Field>
              </div>
              <div className={s.panelActions}>
                <Button size="sm" variant="ghost" onClick={editor.removeSelected}>
                  Delete all
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={s.panelFields}>
                <Field label="Board">{scene.name}</Field>
                <Field label="Cards">{scene.cards.length}</Field>
                <Field label="Sections">{scene.sections.length}</Field>
                <Field label="Live results">{scene.cards.filter((c) => c.live).length}</Field>
              </div>
              <p className={s.liveNote}>
                A card can be bound to a process artifact. The binding is read-only. Thylas does not
                compute here.
              </p>
              <div className={s.panelActions}>
                <Button size="sm" onClick={() => editor.addCardAt({ x: 48, y: 48 })}>
                  Add a card
                </Button>
                <Button size="sm" variant="ghost" onClick={editor.reset}>
                  Reset to sample
                </Button>
              </div>
            </>
          )}
        </div>
      }
    >
      <div className={s.canvasShell}>
        <div className={s.canvasHead}>
          <div className={s.canvasTitleRow}>
            <h1 className={s.canvasTitle}>{scene.name}</h1>
            <Badge>{scene.cards.length} CARDS</Badge>
            <Badge>{scene.cards.filter((c) => c.live).length} LIVE</Badge>
          </div>
          <p className={s.canvasMeta}>
            {getWorkspace(wsId)?.name} · edits are kept in this browser · updated {scene.updated}
          </p>
        </div>

        <div className={s.canvasArea} ref={areaRef} style={sceneVars() as CSSProperties}>
          <div className={s.stage} ref={stageRef}>
            <div
              className={s.scene}
              data-scene="board"
              ref={sceneRef}
              onPointerDown={editor.onPointerDown}
              onDoubleClick={editor.onDoubleClick}
            >
              {scene.sections.map((section) => (
                <div
                  key={section.id}
                  className={s.section}
                  style={{ left: section.x, top: section.y, width: section.w, height: section.h, background: section.tint }}
                >
                  <span className={s.sectionTitle}>{section.title}</span>
                </div>
              ))}

              <svg className={s.edgeLayer} width={SCENE_W} height={SCENE_H} aria-hidden>
                {scene.edges.map((edge) => {
                  const from = scene.cards.find((c) => c.id === edge.from);
                  const to = scene.cards.find((c) => c.id === edge.to);
                  if (!from || !to) return null;
                  const a = center(edge.from);
                  const b = center(edge.to);
                  const x1 = from.x + from.w;
                  const y1 = a.y;
                  const x2 = to.x;
                  const y2 = b.y;
                  const mx = (x1 + x2) / 2;
                  return (
                    <g key={`${edge.from}-${edge.to}`}>
                      <path
                        d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke="var(--ink-3)"
                        strokeWidth={1}
                      />
                      <text x={mx} y={(y1 + y2) / 2 - 5} textAnchor="middle" className={s.edgeLabel}>
                        {edge.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {scene.cards.map((card) => {
                const isSelected = editor.selection.includes(card.id);
                const isEditing = editor.editingId === card.id;
                return (
                  <div
                    key={card.id}
                    data-card-id={card.id}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                    aria-label={`Card: ${card.title || 'Untitled'}`}
                    className={[s.bcard, card.live ? s.bcardLive : '', isSelected ? s.bcardSelected : ''].join(' ')}
                    style={{
                      left: card.x,
                      top: card.y,
                      width: card.w,
                      // 0 means content-sized; only a resized card pins a height.
                      minHeight: card.h || undefined,
                    }}
                  >
                    <span className={s.cardEyebrow}>{card.eyebrow}</span>
                    {isEditing ? (
                      <input
                        className={s.cardInput}
                        defaultValue={card.title}
                        autoFocus
                        aria-label="Card title"
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => {
                          if (e.currentTarget.dataset.cancelled) return;
                          editor.commitTitle(e.currentTarget.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            editor.commitTitle(e.currentTarget.value);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            e.currentTarget.dataset.cancelled = '1';
                            editor.cancelTitle();
                          }
                        }}
                      />
                    ) : (
                      <span className={s.cardTitle}>{card.title || 'Untitled'}</span>
                    )}
                    {card.lines.map((line) => (
                      <span key={line} className={s.cardLine}>
                        {line}
                      </span>
                    ))}
                    {card.ref ? <span className={s.cardRef}>▤ {card.ref}</span> : null}
                    {card.live ? (
                      <span className={s.cardLiveRow}>
                        <span className={s.liveDot} /> LIVE · {card.live.runLabel}
                      </span>
                    ) : null}
                    {isSelected && editor.selection.length === 1 ? (
                      <span className={s.resizeHandle} data-resize aria-hidden />
                    ) : null}
                  </div>
                );
              })}

              <div className={s.guideX} ref={guideXRef} aria-hidden />
              <div className={s.guideY} ref={guideYRef} aria-hidden />
              <div className={s.marquee} ref={marqueeRef} aria-hidden />
            </div>
          </div>

          {empty ? (
            <p className={s.canvasHint}>
              Double-click anywhere to place the first card. Nothing here is generated for you.
            </p>
          ) : null}

          <div className={s.toolbar} role="toolbar" aria-label="Canvas tools">
            <button type="button" className={[s.tool, s.toolOn].join(' ')} title="Select — drag a card, or drag empty space to marquee" aria-pressed>
              ⬚
            </button>
            <button
              type="button"
              className={s.tool}
              title="Undo (⌘Z)"
              disabled={!editor.canUndo}
              onClick={editor.undo}
            >
              ↶
            </button>
            <button
              type="button"
              className={s.tool}
              title="Redo (⇧⌘Z)"
              disabled={!editor.canRedo}
              onClick={editor.redo}
            >
              ↷
            </button>
          </div>

          <div className={s.minimap} aria-hidden>
            <span className={s.minimapLabel}>Board</span>
            <div className={s.minimapStage}>
              {scene.sections.map((section) => (
                <span
                  key={section.id}
                  className={s.minimapSection}
                  style={{
                    left: `${(section.x / SCENE_W) * 100}%`,
                    top: `${(section.y / SCENE_H) * 100}%`,
                    width: `${(section.w / SCENE_W) * 100}%`,
                    height: `${(section.h / SCENE_H) * 100}%`,
                  }}
                />
              ))}
              {scene.cards.map((card) => (
                <span
                  key={card.id}
                  className={s.minimapCard}
                  style={{
                    left: `${(card.x / SCENE_W) * 100}%`,
                    top: `${(card.y / SCENE_H) * 100}%`,
                    width: `${(card.w / SCENE_W) * 100}%`,
                    height: `${Math.max(2, (card.h / SCENE_H) * 100)}%`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className={s.zoomDock}>
            <button type="button" onClick={zoomOut} aria-label="Zoom out">
              −
            </button>
            <span className={s.zoomValue} ref={zoomLabelRef}>
              100%
            </span>
            <button type="button" onClick={zoomIn} aria-label="Zoom in">
              +
            </button>
          </div>

          <div className={s.statusBar}>
            <span>{status}</span>
            <span className={s.statusHint}>
              {editor.lastAction ?? 'Double-click to add · drag to move · ⌘Z to undo'}
            </span>
            <span className={s.statusCount}>{scene.cards.length} cards</span>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
