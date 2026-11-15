import type { FileItem } from '../../data/types';
import p from './preview.module.css';

/**
 * A PDF is rendered by the browser's own viewer: real pagination, real zoom,
 * real text selection, and no megabyte of PDF.js in the bundle.
 *
 * The cost is that inline rendering depends on the browser. When the viewer is
 * unavailable the frame would be a white void, so this falls back to a card
 * that opens the file instead.
 */
export function PdfPreview({ file, url }: { file: FileItem; url: string }) {
  const supported = typeof navigator === 'undefined' || navigator.pdfViewerEnabled !== false;

  if (!supported) {
    return (
      <div className={p.fallback} data-pdf-fallback>
        <p className={p.fallbackTitle}>This browser cannot show a PDF inline.</p>
        <p className={p.fallbackHint}>The file itself is fine — it opens in a new tab.</p>
        <a className={p.openLink} href={url} target="_blank" rel="noreferrer">
          Open {file.name}
        </a>
      </div>
    );
  }

  return (
    <div className={p.pdfWrap}>
      <iframe
        className={p.pdfFrame}
        title={`${file.name} preview`}
        src={`${url}#toolbar=0&navpanes=0&view=FitH`}
        data-pdf-preview
      />
      <a className={p.pdfLink} href={url} target="_blank" rel="noreferrer">
        Open in a new tab
      </a>
    </div>
  );
}
