import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { boardsIn, getBoard, getWorkspace } from '../data/selectors';
import { useRegisterTab } from '../state/app';
import { Badge, Button, EmptyState, Field } from '../components/ui';
import { IconChevron, IconPlus } from '../components/icons';
import { WorkspaceLayout } from '../shell/layouts';
import { CARD_HEADER_CENTER, SCENE_H, SCENE_W, fitScale, sceneVars } from './boards/scene';
import s from './boards.module.css';

export function BoardsPage() {
  const { wsId = '' } = useParams();
  const navigate = useNavigate();
  const ws = getWorkspace(wsId);
  const boards = boardsIn(wsId);
  const [notice, setNotice] = useState(false);

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
          <Button size="sm" icon={<IconPlus size={12} />} onClick={() => setNotice(true)}>
            New board
          </Button>
        </div>

        {notice ? (
          <p className={s.notice} role="status">
            Board creation needs the workspace service. This build reads sample boards only.
          </p>
        ) : null}

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
                  {board.cards} cards · updated {board.updated}
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
  const navigate = useNavigate();
  const board = getBoard(boardId);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(0.72);
  const [selected, setSelected] = useState<string | null>('c-3');
  const [notice, setNotice] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setFit(fitScale(el.clientWidth, el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useRegisterTab(
    `ws:${wsId}`,
    board ? { type: 'board', label: board.name, path: routes.board(wsId, boardId) } : null,
  );

  if (!board) {
    return <EmptyState title="Board not found" hint="It may have been deleted. The tab stays open so the loss is visible." />;
  }

  const cards = board.boardCards;
  const selectedCard = cards.find((c) => c.id === selected) ?? null;
  const empty = board.sections.length === 0;

  const center = (id: string) => {
    const card = cards.find((c) => c.id === id);
    return card ? { x: card.x + card.w / 2, y: card.y + CARD_HEADER_CENTER } : { x: 0, y: 0 };
  };

  return (
    <WorkspaceLayout
      wsId={wsId}
      flush
      panelTitle={selectedCard ? 'Selection' : 'This board'}
      panel={
        <div className={s.panelInner}>
          {selectedCard ? (
            <>
              <h3 className={s.panelCardTitle}>{selectedCard.title}</h3>
              <div className={s.panelFields}>
                <Field label="Type">Card · {selectedCard.eyebrow.toLowerCase().replace(' · ', ' ')}</Field>
                <Field label="Section">{board.sections.find((x) => x.id === selectedCard.sectionId)?.title}</Field>
                <Field label="Refs">{selectedCard.ref ?? '—'}</Field>
              </div>
              {selectedCard.live ? (
                <p className={s.liveNote}>
                  <span className={s.liveDot} /> Live card · binding is read-only. Thylas renders what
                  run {selectedCard.live.runLabel} produced; it does not compute the number.
                </p>
              ) : null}
              <div className={s.panelActions}>
                {selectedCard.ref ? (
                  <Button size="sm" onClick={() => navigate(routes.files(wsId))}>
                    Open reference
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setNotice('Starting a process needs WAM. Nothing was sent.')}>
                  Start a process
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={s.panelFields}>
                <Field label="Board">{board.name}</Field>
                <Field label="Cards">{board.cards}</Field>
                <Field label="Live results">{board.results}</Field>
                <Field label="Updated">{board.updated}</Field>
              </div>
              <p className={s.liveNote}>
                A card can be bound to a process artifact. The binding is read-only. Thylas does not
                compute here.
              </p>
            </>
          )}
          {notice ? <p className={s.panelNotice}>{notice}</p> : null}
        </div>
      }
    >
      <div className={s.canvasShell}>
        <div className={s.canvasHead}>
          <div className={s.canvasTitleRow}>
            <h1 className={s.canvasTitle}>{board.name}</h1>
            <Badge>{board.cards} CARDS</Badge>
            <Badge>{board.results} LIVE</Badge>
          </div>
          <p className={s.canvasMeta}>
            {getWorkspace(wsId)?.name} · updated {board.updated} · read-only in this build
          </p>
        </div>

        <div className={s.canvasArea} ref={areaRef} style={sceneVars() as CSSProperties}>
          {empty ? (
            <EmptyState
              title="This board has no scene yet"
              hint="Editing a board is deferred: the canvas renderer exists, the write model does not."
              action={
                <Button size="sm" onClick={() => navigate(routes.boards(wsId))}>
                  Back to boards
                </Button>
              }
            />
          ) : (
            <div className={s.stage} style={{ width: SCENE_W * fit * zoom, height: SCENE_H * fit * zoom }}>
            <div
              className={s.scene}
              style={{ transform: `scale(${fit * zoom})` }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelected(null);
              }}
            >
              {board.sections.map((section) => (
                <div
                  key={section.id}
                  className={s.section}
                  style={{ left: section.x, top: section.y, width: section.w, height: section.h, background: section.tint }}
                >
                  <span className={s.sectionTitle}>{section.title}</span>
                </div>
              ))}

              <svg className={s.edgeLayer} width={SCENE_W} height={SCENE_H} aria-hidden>
                {board.edges.map((edge) => {
                  const from = cards.find((c) => c.id === edge.from);
                  const to = cards.find((c) => c.id === edge.to);
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

              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={[s.bcard, card.live ? s.bcardLive : '', card.id === selected ? s.bcardSelected : ''].join(' ')}
                  style={{ left: card.x, top: card.y, width: card.w }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(card.id);
                  }}
                >
                  <span className={s.cardEyebrow}>{card.eyebrow}</span>
                  <span className={s.cardTitle}>{card.title}</span>
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
                </button>
              ))}
            </div>
            </div>
          )}

          {empty ? null : (
          <div className={s.toolbar} role="toolbar" aria-label="Canvas tools">
            {['Select', 'Card', 'Section', 'Edge'].map((tool) => (
              <button
                key={tool}
                type="button"
                className={[s.tool, tool === 'Select' ? s.toolOn : ''].join(' ')}
                title={`${tool} tool`}
                onClick={() => tool !== 'Select' && setNotice('Canvas editing is deferred: only selection is wired in this build.')}
              >
                {tool === 'Select' ? '⬚' : tool === 'Card' ? '▭' : tool === 'Section' ? '▢' : '╱'}
              </button>
            ))}
          </div>

          )}
          {empty ? null : (
          <div className={s.minimap} aria-hidden>
            <span className={s.minimapLabel}>Board</span>
            <div className={s.minimapStage}>
              {board.sections.map((section) => (
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
            </div>
          </div>

          )}
          {empty ? null : (
          <div className={s.zoomDock}>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))} aria-label="Zoom out">
              −
            </button>
            <span className={s.zoomValue}>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))} aria-label="Zoom in">
              +
            </button>
          </div>

          )}
          <div className={s.statusBar}>
            <span>{selectedCard ? `Selected · ${selectedCard.title.slice(0, 28)}` : 'No selection'}</span>
            <span className={s.statusHint}>Selection only · drag, edges and writing are deferred</span>
            <span className={s.statusCount}>{board.cards} cards</span>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
