import { useEffect, useState } from 'react';
import type { FileItem, FilePreview } from '../../data/types';
import { MarkdownBody } from '../chat/Markdown';
import { CsvPreview } from './CsvPreview';
import { PdfPreview } from './PdfPreview';
import p from './preview.module.css';

type Loaded = { status: 'loading' } | { status: 'ready'; text: string } | { status: 'failed' };

/**
 * The preview surface for one file.
 *
 * Everything here is sample content: the seeds point at files in
 * `public/samples`, and the bar above the preview says so. Which renderer runs
 * is decided by `preview.kind`, not by the extension — the two cannot drift.
 */
export function PreviewPane({ file, preview }: { file: FileItem; preview: FilePreview }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    if (preview.kind === 'pdf') return;
    let alive = true;
    setLoaded({ status: 'loading' });

    fetch(preview.url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then((text) => {
        if (alive) setLoaded({ status: 'ready', text });
      })
      .catch(() => {
        if (alive) setLoaded({ status: 'failed' });
      });

    return () => {
      alive = false;
    };
  }, [preview.kind, preview.url]);

  return (
    <div className={p.pane} data-preview-kind={preview.kind}>
      <div className={p.paneBar}>
        <span className={p.sampleTag}>sample file</span>
        <a className={p.rawLink} href={preview.url} target="_blank" rel="noreferrer">
          Open raw file
        </a>
      </div>

      {preview.kind === 'pdf' ? <PdfPreview file={file} url={preview.url} /> : null}

      {preview.kind !== 'pdf' && loaded.status === 'loading' ? (
        <div className={p.skeleton} aria-hidden>
          <span className={p.skeletonBar} style={{ width: '38%' }} />
          <span className={p.skeletonBar} style={{ width: '82%' }} />
          <span className={p.skeletonBar} style={{ width: '71%' }} />
          <span className={p.skeletonBar} style={{ width: '64%' }} />
        </div>
      ) : null}

      {preview.kind !== 'pdf' && loaded.status === 'failed' ? (
        <div className={p.fallback} data-preview-failed>
          <p className={p.fallbackTitle}>This preview could not be loaded.</p>
          <p className={p.fallbackHint}>The file is still where it was; the preview is what failed.</p>
          <a className={p.openLink} href={preview.url} target="_blank" rel="noreferrer">
            Open {file.name}
          </a>
        </div>
      ) : null}

      {preview.kind === 'csv' && loaded.status === 'ready' ? <CsvPreview source={loaded.text} /> : null}

      {preview.kind === 'md' && loaded.status === 'ready' ? (
        <div className={p.doc} data-markdown-preview>
          <MarkdownBody source={loaded.text} />
        </div>
      ) : null}
    </div>
  );
}
