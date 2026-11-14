import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { boardsIn, getBoard, getWorkspace } from '../data/selectors';
import type { Board } from '../data/types';
import { useRegisterTab } from '../state/app';
import { Badge, Button, EmptyState, Field, Kbd } from '../components/ui';
import { IconAlign, IconArrow, IconCard, IconChevron, IconCursor, IconDistribute, IconFit, IconFold, IconMinus, IconPlus, IconRedo, IconSection, IconTrash, IconUndo } from '../components/icons';
import { WorkspaceLayout } from '../shell/layouts';
import g from '../styles/grammar.module.css';
import {
  CARD_COLORS,
  SCENE_H,
  SCENE_W,
  anchorOf,
  contentBounds,
  edgeArrowPoints,
  edgeMid,
  edgePath,
  estimateCardHeight,
  sceneFromBoard,
  sceneVars,
  type BoardScene,
  type CardColor,
  type SceneCard,
  type SceneEdge,
  type SceneSection,
} from './boards/scene';
import { createLocalBoardStore } from './boards/store';
import type { AlignMode } from './boards/gestures';
import { useBoardEditor, type Editing } from './boards/useBoardEditor';
import { useCanvasViewport, type ViewportRefs } from './boards/useViewport';
import s from './boards.module.css';

export function BoardsPage() {
  const { wsId = '' } = useParams();
  const navigate = useNavigate();
  const ws = getWorkspace(wsId);
  const boards = boardsIn(wsId);

  if (!ws) return <EmptyState title="Workspace not found" hint="This workspace is gone." />;

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
              className={s.boardIndexCard}
              onClick={() => navigate(routes.board(wsId, board.id))}
            >
              <span className={s.cardPreview} aria-hidden>
                {board.boardCards.slice(0, 6).map((card, i) => (
                  <span key={card.id} className={s.cardTile} data-color={card.color} data-live={i === 2 || undefined} />
                ))}
                {board.boardCards.length === 0
                  ? [0, 1, 2].map((i) => <span key={i} className={s.cardTile} data-empty />)
                  : null}
              </span>
              <span className={s.cardBody}>
                <span className={s.cardTitleRow}>
                  <span className={s.cardName}>{board.name}</span>
                  <IconChevron size={11} />
                </span>
                <span className={s.cardMeta}>
                  {board.boardCards.length} cards · {board.sections.length} sections
                </span>
                <span className={s.cardMeta}>updated {board.updated}</span>
              </span>
            </button>
          ))}
          {boards.length === 0 ? (
            <EmptyState title="No boards yet" hint="Create the first board." />
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
    return <EmptyState title="Board not found" hint="This tab stays open so the loss is visible." />;
  }

  // Keyed so switching boards starts from that board's scene instead of
  // carrying the previous card list and undo stack across.
  return <BoardCanvas key={board.id} wsId={wsId} board={board} />;
}

function BoardCanvas({ wsId, board }: { wsId: string; board: Board }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef<SVGGElement>(null);
  const sceneLive = useRef<BoardScene | null>(null);
  const [, bump] = useState(0);

  const refs: ViewportRefs = { area: areaRef, scene: sceneRef, zoomLabel: zoomLabelRef };
  const { zoomIn, zoomOut, zoomTo, fit, panByScreen, centerOn, view } = useCanvasViewport(refs, {
    // Fit is measured against the content, never against the 2400 × 1600
    // workspace: an almost empty board must not be shrunk to a stamp.
    getBounds: () =>
      contentBounds(sceneLive.current ?? { sections: [], cards: [] }),
    onSettle: () => bump((n) => n + 1),
  });

  const store = useMemo(() => createLocalBoardStore(window.localStorage), []);
  const initial = useMemo(() => sceneFromBoard(board), [board]);
  const saved = useMemo<BoardScene | null>(() => {
    const result = store.load(board.id);
    return result.ok ? result.scene : null;
  }, [store, board.id]);

  const editor = useBoardEditor({
    initial,
    refs: { scene: sceneRef, area: areaRef, marquee: marqueeRef, guides: guidesRef },
    view,
    panByScreen,
    store,
    saved,
  });
  sceneLive.current = editor.scene;

  const { scene, selection, selectedCards, selectedSections, selectedEdge } = editor;
  const zoom = view.current.zoom;
  const counts = {
    cards: scene.cards.length,
    sections: scene.sections.length,
    edges: scene.edges.length,
  };
  const empty = scene.cards.length === 0 && scene.sections.length === 0;

  /* Screen-space chrome (selection bar, edge controls) is positioned from the
     scene's bounding box. It is recomputed when the view settles, and hidden
     mid-gesture so it never drifts away from the object it points at. */
  const toScreen = (x: number, y: number) => {
    const sceneEl = sceneRef.current;
    const areaEl = areaRef.current;
    if (!sceneEl || !areaEl) return { left: 0, top: 0 };
    const sc = sceneEl.getBoundingClientRect();
    const ar = areaEl.getBoundingClientRect();
    return { left: sc.left - ar.left + x * zoom, top: sc.top - ar.top + y * zoom };
  };

  const selectionBox = useMemo(() => {
    const rects = [
      ...selectedCards.map((card) => ({ x: card.x, y: card.y, w: card.w, h: card.h || estimateCardHeight(card) })),
      ...selectedSections,
    ];
    if (rects.length === 0) return null;
    const left = Math.min(...rects.map((r) => r.x));
    const top = Math.min(...rects.map((r) => r.y));
    const right = Math.max(...rects.map((r) => r.x + r.w));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    const at = toScreen(left, top);
    return { left: at.left, top: at.top, width: (right - left) * zoom, height: (bottom - top) * zoom };
  }, [selectedCards, selectedSections, zoom, scene, selection]);


  const bounds = contentBounds(scene);
  const viewRect = {
    x: (0 - view.current.x) / zoom,
    y: (0 - view.current.y) / zoom,
    w: (areaRef.current?.clientWidth ?? 0) / zoom,
    h: (areaRef.current?.clientHeight ?? 0) / zoom,
  };

  const status = selectedEdge
    ? `Edge · ${edgeTitle(selectedEdge, scene)}`
    : selection.length > 1
      ? `${selection.length} selected`
      : selectedCards[0]
        ? `Selected · ${selectedCards[0].title || 'Untitled card'}`
        : selectedSections[0]
          ? `Section · ${selectedSections[0].title}`
          : 'Nothing selected';

  const panelTitle = selectedEdge ? 'Edge' : selection.length > 0 ? 'Selection' : 'This board';

  return (
    <WorkspaceLayout
      wsId={wsId}
      flush
      panelTitle={panelTitle}
      panel={
        <BoardPanel editor={editor} scene={scene} onJump={centerOn} />
      }
    >
      <div className={s.boardShell}>
        <header className={s.boardHead}>
          <div className={s.headMain}>
            <h1 className={s.boardName}>{scene.name}</h1>
            <div className={s.headBadges}>
              <Badge>{counts.cards} CARDS</Badge>
              <Badge>{counts.sections} SECTIONS</Badge>
              <Badge>{counts.edges} EDGES</Badge>
            </div>
          </div>
          <p className={s.headMeta}>
            {getWorkspace(wsId)?.name} · edits are kept in this browser · updated {scene.updated}
          </p>
        </header>

        <div
          className={s.canvasArea}
          ref={areaRef}
          style={sceneVars() as CSSProperties}
          data-board-canvas
          data-tool={editor.tool}
        >
          <div
            className={s.scene}
            data-scene="board"
            ref={sceneRef}
            onPointerDown={editor.onPointerDown}
            onDoubleClick={editor.onDoubleClick}
            onContextMenu={(e) => editor.onContextMenu(e, null)}
          >
            {scene.sections.map((section) => (
              <SectionNode
                key={section.id}
                section={section}
                count={scene.cards.filter((card) => card.sectionId === section.id).length}
                selected={selection.includes(section.id)}
                editing={editor.editing}
                onEditTitle={editor.setEditing}
                onCommit={editor.commitEditing}
                onContextMenu={(e) => editor.onContextMenu(e, section.id)}
              />
            ))}

            <svg className={s.edgeLayer} width={SCENE_W} height={SCENE_H} aria-hidden={false}>
              <g ref={guidesRef} className={s.guides} />
              {scene.edges.map((edge) => {
                const geometry = edgeGeometry(edge, scene);
                if (!geometry) return null;
                const selected = selection.includes(edge.id);
                return (
                  <g key={edge.id} className={s.edge} data-selected={selected || undefined}>
                    <path className={s.edgeLine} d={geometry.path} vectorEffect="non-scaling-stroke" />
                    {geometry.arrows.map((arrow, i) => (
                      <path key={i} className={s.edgeHead} d={arrow} vectorEffect="non-scaling-stroke" />
                    ))}
                    <path
                      className={s.edgeHit}
                      d={geometry.path}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        editor.selectEdge(edge.id);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                    />
                  </g>
                );
              })}
              {editor.linkPreview ? (
                <path
                  className={s.linkPreview}
                  d={edgePath(
                    editor.linkPreview.from,
                    editor.linkPreview.to,
                    editor.linkPreview.side,
                    editor.linkPreview.toSide,
                    'curve',
                  )}
                />
              ) : null}
              {editor.selectedEdge ? <BendHandle edge={editor.selectedEdge} scene={scene} onDown={editor.startBend} onReset={editor.resetBend} /> : null}
            </svg>

            {scene.cards.map((card) => {
              const section = scene.sections.find((x) => x.id === card.sectionId);
              if (section?.collapsed) return null;
              const isSelected = selection.includes(card.id);
              const edit =
                editor.editing?.kind === 'card' && editor.editing.id === card.id ? editor.editing : null;
              return (
                <article
                  key={card.id}
                  data-card-id={card.id}
                  data-color={edit ? 'plain' : card.color}
                  data-folded={card.folded || undefined}
                  data-selected={isSelected || undefined}
                  data-editing={edit ? true : undefined}
                  onContextMenu={(e) => editor.onContextMenu(e, card.id)}
                  className={s.boardCard}
                  style={{
                    left: card.x,
                    top: card.y,
                    width: card.w,
                    ...(card.folded
                      ? { height: 44 }
                      : card.h
                        ? { height: card.h }
                        : {}),
                  }}
                >
                  {edit ? (
                    <CardEditor
                      card={card}
                      editing={edit}
                      onChange={editor.setEditing}
                      onCommit={editor.commitEditing}
                    />
                  ) : (
                    <>
                      <span className={s.cardEyebrow}>{card.eyebrow}</span>
                      <h3 className={s.cardTitle}>{card.title || 'Untitled'}</h3>
                      {!card.folded
                        ? card.lines.map((line, i) => (
                            <span key={i} className={s.cardLine}>
                              {line}
                            </span>
                          ))
                        : null}
                      {card.ref && !card.folded ? <span className={s.cardRef}>{card.ref}</span> : null}
                      {card.live && !card.folded ? (
                        <span className={s.cardLive}>
                          <i className={s.liveDot} /> LIVE · {card.live.runLabel}
                        </span>
                      ) : null}
                      {card.folded ? <span className={s.foldMark} aria-hidden /> : null}
                      <Anchors />
                      {isSelected && selection.length === 1 ? <Handles /> : null}
                    </>
                  )}
                </article>
              );
            })}

            <svg className={s.labelLayer} width={SCENE_W} height={SCENE_H} aria-hidden>
              {scene.edges.map((edge) => {
                const geometry = edgeGeometry(edge, scene);
                if (!geometry || !edge.label) return null;
                const width = edge.label.length * 6.4 + 14;
                return (
                  <g
                    key={edge.id}
                    className={s.edgeLabel}
                    data-selected={selection.includes(edge.id) || undefined}
                    transform={`translate(${geometry.mid.x} ${geometry.mid.y})`}
                  >
                    <rect x={-width / 2} y={-9} width={width} height={18} rx={3} />
                    <text textAnchor="middle" dominantBaseline="central">
                      {edge.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className={s.marquee} ref={marqueeRef} aria-hidden />
          </div>

          {empty ? (
            <p className={s.canvasHint}>
              Double-click to place the first card.
            </p>
          ) : null}

          <div className={s.toolbar} role="toolbar" aria-label="Canvas tools">
            <ToolButton label="Select — drag to move, drag empty space to marquee" active={editor.tool === 'select'} onClick={() => editor.setTool('select')}>
              <IconCursor size={15} />
            </ToolButton>
            <ToolButton label="Card — click the canvas to place a card" active={editor.tool === 'card'} onClick={() => editor.setTool('card')}>
              <IconCard size={15} />
            </ToolButton>
            <ToolButton label="Section — click the canvas to place a section" active={editor.tool === 'section'} onClick={() => editor.setTool('section')}>
              <IconSection size={15} />
            </ToolButton>
            <span className={s.toolDivider} />
            <ToolButton label="Undo (⌘Z)" onClick={editor.undo} disabled={!editor.canUndo}>
              <IconUndo size={15} />
            </ToolButton>
            <ToolButton label="Redo (⇧⌘Z)" onClick={editor.redo} disabled={!editor.canRedo}>
              <IconRedo size={15} />
            </ToolButton>
          </div>

          <div className={s.minimap} aria-hidden>
            <span className={s.minimapLabel}>Board</span>
            <div
              className={s.minimapStage}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                centerOn({
                  x: bounds.x + ((e.clientX - rect.left) / rect.width) * bounds.w,
                  y: bounds.y + ((e.clientY - rect.top) / rect.height) * bounds.h,
                });
              }}
            >
              {scene.sections.map((section) => (
                <span
                  key={section.id}
                  className={s.minimapSection}
                  data-color={section.color}
                  style={minimapStyle(section, bounds)}
                />
              ))}
              {scene.cards.map((card) => (
                <span
                  key={card.id}
                  className={s.minimapCard}
                  data-color={card.color}
                  style={minimapStyle({ ...card, h: card.h || estimateCardHeight(card) }, bounds)}
                />
              ))}
              <span className={s.minimapView} style={minimapStyle(viewRect, bounds)} />
            </div>
          </div>

          <div className={s.zoomDock}>
            <button type="button" onClick={zoomOut} aria-label="Zoom out" title="Zoom out (⌘−)">
              <IconMinus size={13} />
            </button>
            <span className={s.zoomValue} ref={zoomLabelRef}>
              100%
            </span>
            <button type="button" onClick={zoomIn} aria-label="Zoom in" title="Zoom in (⌘+)">
              <IconPlus size={13} />
            </button>
            <span className={s.dockDivider} />
            <button type="button" onClick={() => zoomTo(1)} title="Reset to 100%">
              1:1
            </button>
            <button type="button" onClick={fit} aria-label="Fit the board" title="Fit (⌘0)">
              <IconFit size={13} />
            </button>
          </div>

          <div className={s.statusDock} role="status">
            <span className={s.statusMain}>{status}</span>
            <span className={s.statusHint}>
              {editor.lastAction ?? (selection.length === 0 ? 'Double-click to add · hover a card to connect' : '')}
            </span>
            <span className={s.statusCount}>
              {/* Zoom lives in the dock, where it updates on every wheel tick;
                  a second copy here would lag until the next render. */}
              {counts.cards} cards · {counts.sections} sections
            </span>
          </div>

          {selectionBox && selection.length > 0 && !editor.editing ? (
            <div
              className={s.selectionHud}
              style={{
                left: clampLeft(selectionBox.left + selectionBox.width / 2, areaRef.current?.clientWidth ?? 0),
                top: Math.max(8, selectionBox.top - 44),
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className={s.hudCount}>{selection.length}</span>
              <span className={s.hudDivider} />
              {CARD_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={s.swatch}
                  data-color={color}
                  aria-label={`Colour ${color}`}
                  aria-pressed={selectedCards.every((card) => card.color === color) && selectedCards.length > 0}
                  onClick={() => editor.setColor(color)}
                />
              ))}
              <span className={s.hudDivider} />
              <button type="button" className={s.hudBtn} onClick={editor.toggleFold} title="Fold / unfold (F)">
                <IconFold size={13} />
              </button>
              <button
                type="button"
                className={s.hudBtn}
                onClick={editor.deleteSelection}
                title="Delete (⌫)"
                data-danger
              >
                <IconTrash size={13} />
              </button>
            </div>
          ) : null}

          {editor.selectedEdge && !editor.editing ? (
            <div
              className={s.edgeHud}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className={s.hudLabel}>Edge</span>
              <Segmented
                value={editor.selectedEdge?.shape ?? 'curve'}
                options={[
                  ['curve', 'Curve'],
                  ['ortho', 'Elbow'],
                ]}
                onChange={(value) =>
                  editor.selectedEdge && editor.updateEdge(editor.selectedEdge.id, { shape: value as 'curve' | 'ortho' })
                }
              />
              <Segmented
                value={editor.selectedEdge?.direction ?? 'none'}
                options={[
                  ['none', '—'],
                  ['one', '→'],
                  ['both', '↔'],
                ]}
                onChange={(value) =>
                  editor.selectedEdge &&
                  editor.updateEdge(editor.selectedEdge.id, { direction: value as 'none' | 'one' | 'both' })
                }
              />
              <button type="button" className={s.hudBtn} onClick={editor.deleteSelection} title="Delete the edge" data-danger>
                <IconTrash size={13} />
              </button>
            </div>
          ) : null}

          {editor.contextMenu ? (
            <ContextMenu
              x={editor.contextMenu.x}
              y={editor.contextMenu.y}
              target={editor.contextMenu.target}
              kind={
                selection.length > 1
                  ? 'many'
                  : selectedSections.length === 1
                    ? 'section'
                    : selectedCards.length === 1
                      ? 'card'
                      : 'none'
              }
              count={selection.length}
              hasCard={selectedCards.length > 0}
              onPick={(action) => {
                editor.dismissMenu();
                if (action === 'open') editor.openCard(selectedCards[0]?.id ?? '');
                if (action === 'editSection') {
                  const section = selectedSections[0];
                  if (section) editor.setEditing({ kind: 'section', id: section.id, title: section.title });
                }
                if (action === 'fold') editor.toggleFold();
                if (action === 'duplicate') editor.duplicate();
                if (action === 'delete') editor.deleteSelection();
                if (action === 'newCard') {
                  const rect = areaRef.current?.getBoundingClientRect();
                  const sceneEl = sceneRef.current?.getBoundingClientRect();
                  if (!rect || !sceneEl) return;
                  editor.addCardAt({
                    x: (editor.contextMenu?.x ?? rect.left) - sceneEl.left,
                    y: (editor.contextMenu?.y ?? rect.top) - sceneEl.top,
                  });
                }
                if (action === 'newSection') {
                  const rect = areaRef.current?.getBoundingClientRect();
                  const sceneEl = sceneRef.current?.getBoundingClientRect();
                  if (!rect || !sceneEl) return;
                  editor.addSectionAt({
                    x: (editor.contextMenu?.x ?? rect.left) - sceneEl.left,
                    y: (editor.contextMenu?.y ?? rect.top) - sceneEl.top,
                  });
                }
                if (action === 'fit') fit();
                if (action === 'undo') editor.undo();
              }}
            />
          ) : null}
        </div>
      </div>
    </WorkspaceLayout>
  );
}

/* ---------- pieces ---------- */

function SectionNode({
  section,
  count,
  selected,
  editing,
  onEditTitle,
  onCommit,
  onContextMenu,
}: {
  section: SceneSection;
  count: number;
  selected: boolean;
  editing: Editing | null;
  onEditTitle: (next: Editing | null) => void;
  onCommit: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const isEditing = editing?.kind === 'section' && editing.id === section.id;
  return (
    <div
      className={s.section}
      data-section-id={section.id}
      data-color={section.color}
      data-selected={selected || undefined}
      data-collapsed={section.collapsed || undefined}
      style={{ left: section.x, top: section.y, width: section.w, height: section.h }}
      onContextMenu={onContextMenu}
    >
      <div className={s.sectionCapsule} onDoubleClick={() => onEditTitle({ kind: 'section', id: section.id, title: section.title })}>
        {isEditing && editing ? (
          <input
            className={s.sectionInput}
            data-editor
            autoFocus
            defaultValue={editing.title}
            aria-label="Section title"
            onFocus={(e) => e.currentTarget.select()}
            onBlur={onCommit}
            onChange={(e) => onEditTitle({ ...editing, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                onCommit();
              }
            }}
          />
        ) : (
          <>
            <span className={s.sectionName}>{section.title || 'Untitled section'}</span>
            <span className={s.sectionCount}>{count}</span>
          </>
        )}
      </div>
      {section.collapsed ? (
        <span className={s.sectionFolded}>
          {count} {count === 1 ? 'card' : 'cards'} · folded
        </span>
      ) : null}
      {selected ? <Handles /> : null}
    </div>
  );
}

function CardEditor({
  card,
  editing,
  onChange,
  onCommit,
}: {
  card: SceneCard;
  editing: Extract<Editing, { kind: 'card' }>;
  onChange: (next: Editing | null) => void;
  onCommit: () => void;
}) {
  return (
    <div
      className={s.editor}
      data-editor
      style={{ width: Math.max(card.w, 320) }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        onCommit();
      }}
    >
      <input
        className={s.editorTitle}
        autoFocus
        value={editing.title}
        placeholder="Card title"
        aria-label="Card title"
        onChange={(e) => onChange({ ...editing, title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCommit();
          }
        }}
      />
      <textarea
        className={s.editorBody}
        value={editing.body}
        placeholder="Body — one line per row"
        aria-label="Card body"
        rows={4}
        onChange={(e) => onChange({ ...editing, body: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            onCommit();
          }
        }}
      />
      <span className={s.editorFoot}>Esc or ⌘Enter saves · changes are kept in this browser</span>
    </div>
  );
}

function Anchors() {
  return (
    <span className={s.anchors} aria-hidden>
      {(['t', 'r', 'b', 'l'] as const).map((side) => (
        <i key={side} data-side={side} data-anchor={side} />
      ))}
    </span>
  );
}

const RESIZE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

function Handles() {
  return (
    <span className={s.handles} aria-hidden>
      {RESIZE_DIRS.map((dir) => (
        <i key={dir} data-resize={dir} data-dir={dir} />
      ))}
    </span>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={s.tool}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <span className={s.segmented}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          data-on={value === key || undefined}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

const ALIGN_OPTIONS: Array<[AlignMode, 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom', string]> = [
  ['left', 'left', 'Align left'],
  ['centerH', 'centerH', 'Align centres horizontally'],
  ['right', 'right', 'Align right'],
  ['top', 'top', 'Align top'],
  ['centerV', 'centerV', 'Align centres vertically'],
  ['bottom', 'bottom', 'Align bottom'],
];

function BoardPanel({
  editor,
  scene,
  onJump,
}: {
  editor: ReturnType<typeof useBoardEditor>;
  scene: BoardScene;
  onJump: (point: { x: number; y: number }) => void;
}) {
  const { selectedCards, selectedSections, selectedEdge, selection } = editor;
  const card = selectedCards.length === 1 ? selectedCards[0] : null;
  const section = selectedSections.length === 1 ? selectedSections[0] : null;
  const multi = selection.length > 1;

  if (selectedEdge) {
    const from = objectTitle(scene, selectedEdge.from);
    const to = objectTitle(scene, selectedEdge.to);
    return (
      <div className={s.panelInner}>
        <h3 className={s.panelCardTitle}>
          {from} <span className={s.panelArrow}><IconArrow size={11} /></span> {to}
        </h3>
        <div className={s.panelFields}>
          <Field label="From">{from}</Field>
          <Field label="To">{to}</Field>
          <Field label="Label">{selectedEdge.label || '—'}</Field>
        </div>
        <label className={s.panelInputRow}>
          <span className={s.panelLabel}>Edge label</span>
          <input
            key={selectedEdge.id}
            className={s.panelInput}
            defaultValue={selectedEdge.label ?? ''}
            placeholder="supports, contradicts…"
            onBlur={(e) => {
              const value = e.currentTarget.value.trim();
              if (value !== (selectedEdge.label ?? '')) editor.updateEdge(selectedEdge.id, { label: value });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
        <div className={s.panelActions}>
          <Button size="sm" variant="ghost" icon={<IconTrash size={12} />} onClick={editor.deleteSelection}>
            Delete edge
          </Button>
        </div>
      </div>
    );
  }

  if (card) {
    return (
      <div className={s.panelInner}>
        <h3 className={s.panelCardTitle}>{card.title || 'Untitled card'}</h3>
        <div className={s.panelFields}>
          <Field label="Type">Card · {card.eyebrow.toLowerCase()}</Field>
          <Field label="Section">
            {scene.sections.find((x) => x.id === card.sectionId)?.title ?? 'Unassigned'}
          </Field>
          <Field label="Position">
            <span className={s.monoValue}>
              {Math.round(card.x)}, {Math.round(card.y)}
            </span>
          </Field>
          <Field label="Size">
            <span className={s.monoValue}>
              {Math.round(card.w)} × {card.folded ? 44 : card.h || 'auto'}
            </span>
          </Field>
          <Field label="Refs">{card.ref ?? '—'}</Field>
        </div>
        {card.live ? (
          <p className={s.liveNote}>
            <span className={s.liveDot} /> Live card · binding is read-only. Thylas renders what run{' '}
            {card.live.runLabel} produced; it does not compute the number.
          </p>
        ) : null}
        <ColorRow value={card.color} onChange={editor.setColor} />
        <div className={s.panelActions}>
          {card.ref ? <Button size="sm" onClick={() => onJump({ x: card.x, y: card.y })}>Centre</Button> : null}
          <Button size="sm" onClick={() => editor.openCard(card.id)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={editor.toggleFold}>
            {card.folded ? 'Unfold' : 'Fold'}
          </Button>
          <Button size="sm" variant="ghost" icon={<IconTrash size={12} />} onClick={editor.deleteSelection}>
            Delete
          </Button>
        </div>
      </div>
    );
  }

  if (section) {
    return (
      <div className={s.panelInner}>
        <h3 className={s.panelCardTitle}>{section.title}</h3>
        <div className={s.panelFields}>
          <Field label="Type">Section</Field>
          <Field label="Cards">{scene.cards.filter((c) => c.sectionId === section.id).length}</Field>
          <Field label="Position">
            <span className={s.monoValue}>
              {Math.round(section.x)}, {Math.round(section.y)}
            </span>
          </Field>
          <Field label="Size">
            <span className={s.monoValue}>
              {Math.round(section.w)} × {Math.round(section.h)}
            </span>
          </Field>
        </div>
        <ColorRow value={section.color} onChange={editor.setColor} />
        <div className={s.panelActions}>
          <Button
            size="sm"
            onClick={() => editor.setEditing({ kind: 'section', id: section.id, title: section.title })}
          >
            Rename
          </Button>
          <Button size="sm" variant="ghost" onClick={editor.toggleFold}>
            {section.collapsed ? 'Open' : 'Collapse'}
          </Button>
          <Button size="sm" variant="ghost" icon={<IconTrash size={12} />} onClick={editor.deleteSelection}>
            Delete
          </Button>
        </div>
      </div>
    );
  }

  if (multi) {
    return (
      <div className={s.panelInner}>
        <h3 className={s.panelCardTitle}>{selection.length} objects</h3>
        <div className={s.panelFields}>
          <Field label="Cards">{selectedCards.length}</Field>
          <Field label="Sections">{selectedSections.length}</Field>
        </div>
        <span className={s.panelLabel}>Align</span>
        <div className={s.alignGrid}>
          {ALIGN_OPTIONS.map(([mode, dir, label]) => (
            <button key={mode} type="button" className={s.alignBtn} title={label} aria-label={label} onClick={() => editor.align(mode)}>
              <IconAlign size={14} dir={dir} />
            </button>
          ))}
        </div>
        <span className={s.panelLabel}>Distribute</span>
        <div className={s.alignGrid}>
          <button type="button" className={s.alignBtn} title="Distribute horizontally" aria-label="Distribute horizontally" onClick={() => editor.distribute('h')}>
            <IconDistribute size={14} axis="h" />
          </button>
          <button type="button" className={s.alignBtn} title="Distribute vertically" aria-label="Distribute vertically" onClick={() => editor.distribute('v')}>
            <IconDistribute size={14} axis="v" />
          </button>
        </div>
        <ColorRow value={null} onChange={editor.setColor} />
        <div className={s.panelActions}>
          <Button size="sm" variant="ghost" onClick={editor.duplicate} disabled={selectedCards.length === 0}>
            Duplicate cards
          </Button>
          <Button size="sm" variant="ghost" icon={<IconTrash size={12} />} onClick={editor.deleteSelection}>
            Delete all
          </Button>
        </div>
      </div>
    );
  }

  const boards = scene.cards.filter((c) => c.live).length;
  return (
    <div className={s.panelInner}>
      <div className={s.panelFields}>
        <Field label="Board">{scene.name}</Field>
        <Field label="Cards">{scene.cards.length}</Field>
        <Field label="Sections">{scene.sections.length}</Field>
        <Field label="Edges">{scene.edges.length}</Field>
        <Field label="Live results">{boards}</Field>
      </div>
      <div className={s.keys}>
        <div><Kbd>drag</Kbd> move · snap keeps one axis</div>
        <div><Kbd>drag empty</Kbd> marquee · <Kbd>shift</Kbd> adds</div>
        <div><Kbd>hover card</Kbd> drag a side dot to connect</div>
        <div><Kbd>double-click</Kbd> edit a card, or add one</div>
        <div><Kbd>⌘Z</Kbd> undo · <Kbd>⇧⌘Z</Kbd> redo · <Kbd>⌘A</Kbd> all</div>
        <div><Kbd>space</Kbd> pan · <Kbd>⌘0</Kbd> fit · <Kbd>F</Kbd> fold</div>
      </div>
      <div className={s.panelActions}>
        <Button size="sm" icon={<IconPlus size={12} />} onClick={() => editor.addCardAt({ x: 160, y: 160 })}>
          Add a card
        </Button>
        <Button size="sm" variant="ghost" onClick={editor.reset}>
          Reset to sample
        </Button>
      </div>
    </div>
  );
}

function ColorRow({ value, onChange }: { value: CardColor | null; onChange: (color: CardColor) => void }) {
  return (
    <div className={s.colorRow}>
      <span className={s.panelLabel}>Fill</span>
      <div className={s.colorButtons}>
        {CARD_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={s.swatch}
            data-color={color}
            aria-label={`Fill ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  );
}

function ContextMenu({
  x,
  y,
  target,
  kind,
  count,
  hasCard,
  onPick,
}: {
  x: number;
  y: number;
  target: 'blank' | 'object';
  /** What the menu speaks for: one card, one frame, or the whole selection. */
  kind: 'card' | 'section' | 'many' | 'none';
  count: number;
  hasCard: boolean;
  onPick: (action: string) => void;
}) {
  const items: Array<{ id: string; label: string; hint?: string; danger?: boolean } | { divider: true; id: string }> =
    target === 'object'
      ? [
          // One-object actions only appear when exactly one object is picked;
          // duplicated and deleted objects always follow the selection.
          ...(kind === 'card' ? [{ id: 'open', label: 'Edit card', hint: '↵' }] : []),
          ...(kind === 'section' ? [{ id: 'editSection', label: 'Rename section' }] : []),
          { id: 'fold', label: 'Fold / unfold', hint: 'F' },
          { id: 'duplicate', label: count > 1 ? `Duplicate ${count}` : 'Duplicate', hint: '⌘D' },
          { divider: true, id: 'd1' },
          { id: 'delete', label: count > 1 ? `Delete ${count}` : 'Delete', hint: '⌫', danger: true },
        ]
      : [
          { id: 'newCard', label: 'New card', hint: 'N' },
          { id: 'newSection', label: 'New section', hint: 'S' },
          { divider: true, id: 'd1' },
          { id: 'fit', label: 'Fit the board', hint: '⌘0' },
          { id: 'undo', label: 'Undo', hint: '⌘Z' },
        ];
  return (
    <div className={s.menu} style={{ left: x, top: y }} role="menu" onPointerDown={(e) => e.stopPropagation()}>
      {items.map((item) =>
        'divider' in item ? (
          <span key={item.id} className={s.menuDivider} />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            data-danger={item.danger || undefined}
            disabled={item.id === 'duplicate' && !hasCard}
            onClick={() => onPick(item.id)}
          >
            <span>{item.label}</span>
            {item.hint ? <kbd>{item.hint}</kbd> : null}
          </button>
        ),
      )}
    </div>
  );
}

function BendHandle({
  edge,
  scene,
  onDown,
  onReset,
}: {
  edge: SceneEdge;
  scene: BoardScene;
  onDown: (e: React.PointerEvent, id: string) => void;
  onReset: (id: string) => void;
}) {
  const geometry = edgeGeometry(edge, scene);
  if (!geometry || edge.shape === 'ortho') return null;
  return (
    <circle
      className={s.bendHandle}
      cx={geometry.mid.x}
      cy={geometry.mid.y}
      r={5}
      onPointerDown={(e) => onDown(e, edge.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset(edge.id);
      }}
    />
  );
}

/* ---------- geometry helpers ---------- */

function rectOf(scene: BoardScene, id: string) {
  const card = scene.cards.find((c) => c.id === id);
  if (card) return { x: card.x, y: card.y, w: card.w, h: card.h || estimateCardHeight(card) };
  const section = scene.sections.find((x) => x.id === id);
  return section ? { x: section.x, y: section.y, w: section.w, h: section.h } : null;
}

function edgeGeometry(edge: SceneEdge, scene: BoardScene) {
  const from = rectOf(scene, edge.from);
  const to = rectOf(scene, edge.to);
  if (!from || !to) return null;
  const a = anchorOf(from, edge.fromSide);
  const b = anchorOf(to, edge.toSide);
  const path = edgePath(a, b, edge.fromSide, edge.toSide, edge.shape, edge.bend);
  const mid = edgeMid(a, b, edge.fromSide, edge.toSide, edge.bend);
  const arrows: string[] = [];
  if (edge.direction !== 'none') {
    const head = edgeArrowPoints(a, b, edge.fromSide, edge.toSide, edge.bend);
    arrows.push(`M ${head.left.x} ${head.left.y} L ${head.tip.x} ${head.tip.y} L ${head.right.x} ${head.right.y}`);
  }
  if (edge.direction === 'both') {
    const head = edgeArrowPoints(b, a, edge.toSide, edge.fromSide, edge.bend);
    arrows.push(`M ${head.left.x} ${head.left.y} L ${head.tip.x} ${head.tip.y} L ${head.right.x} ${head.right.y}`);
  }
  return { path, mid, arrows, label: edge.label };
}

function edgeTitle(edge: SceneEdge, scene: BoardScene) {
  return `${objectTitle(scene, edge.from)} → ${objectTitle(scene, edge.to)}`;
}

function objectTitle(scene: BoardScene, id: string) {
  const card = scene.cards.find((c) => c.id === id);
  if (card) return card.title || 'Untitled card';
  return scene.sections.find((s) => s.id === id)?.title ?? 'Missing object';
}

function minimapStyle(rect: { x: number; y: number; w: number; h: number }, bounds: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${((rect.x - bounds.x) / bounds.w) * 100}%`,
    top: `${((rect.y - bounds.y) / bounds.h) * 100}%`,
    width: `${Math.max(0.6, (rect.w / bounds.w) * 100)}%`,
    height: `${Math.max(0.6, (rect.h / bounds.h) * 100)}%`,
  };
}

function clampLeft(centerX: number, areaWidth: number) {
  const width = 320;
  if (areaWidth <= 0) return centerX;
  return Math.min(Math.max(width / 2 + 8, centerX), Math.max(width / 2 + 8, areaWidth - width / 2 - 8));
}
