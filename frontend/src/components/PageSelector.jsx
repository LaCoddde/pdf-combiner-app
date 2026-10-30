import { useEffect, useRef, useState } from 'react';
import pdfjs from '../pdf';
import './PageSelector.css';

const PageThumbnail = ({ pdf, pageNumber, selected, onToggle }) => {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 124 / baseViewport.width });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const outputScale = 1.5;
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

        renderTask = page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
        if (!cancelled) setReady(true);
        page.cleanup();
      } catch (error) {
        if (!cancelled && error?.name !== 'RenderingCancelledException') {
          setReady(false);
        }
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdf]);

  return (
    <button
      type="button"
      className={`page-thumbnail ${selected ? 'selected' : ''}`}
      onClick={() => onToggle(pageNumber)}
      aria-pressed={selected}
      aria-label={`${selected ? 'Deselect' : 'Select'} page ${pageNumber}`}
    >
      <span className="page-canvas-wrap">
        <canvas ref={canvasRef} className={ready ? 'visible' : ''} />
        {!ready && <span className="page-loading">Loading</span>}
        <span className="page-check" aria-hidden="true">{selected ? '✓' : ''}</span>
      </span>
      <span className="page-number">Page {pageNumber}</span>
    </button>
  );
};

const PageSelector = ({ file, selectedPages, onSelectionChange }) => {
  const [pdf, setPdf] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    let loadedPdf;

    setPdf(null);
    setStatus('loading');
    onSelectionChange([]);

    const loadPdf = async () => {
      try {
        const data = await file.arrayBuffer();
        if (cancelled) return;
        loadingTask = pdfjs.getDocument({ data });
        loadedPdf = await loadingTask.promise;
        if (cancelled) {
          await loadedPdf.destroy();
          return;
        }
        setPdf(loadedPdf);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
      setPdf(null);
      loadingTask?.destroy();
    };
  }, [file, onSelectionChange]);

  const togglePage = (pageNumber) => {
    const nextSelection = selectedPages.includes(pageNumber)
      ? selectedPages.filter((number) => number !== pageNumber)
      : [...selectedPages, pageNumber].sort((a, b) => a - b);
    onSelectionChange(nextSelection);
  };

  if (status === 'loading') {
    return <p className="page-selector-status">Loading page previews...</p>;
  }

  if (status === 'error' || !pdf) {
    return <p className="page-selector-status error">This PDF could not be previewed.</p>;
  }

  const allPages = Array.from({ length: pdf.numPages }, (_, index) => index + 1);

  return (
    <section className="page-selector" aria-labelledby="page-selector-title">
      <div className="page-selector-header">
        <div>
          <h3 id="page-selector-title">Choose pages</h3>
          <p>{selectedPages.length} of {pdf.numPages} selected</p>
        </div>
        <div className="page-selector-actions">
          <button type="button" onClick={() => onSelectionChange(allPages)}>Select all</button>
          <button type="button" onClick={() => onSelectionChange([])}>Clear</button>
        </div>
      </div>
      <div className="page-grid">
        {allPages.map((pageNumber) => (
          <PageThumbnail
            key={pageNumber}
            pdf={pdf}
            pageNumber={pageNumber}
            selected={selectedPages.includes(pageNumber)}
            onToggle={togglePage}
          />
        ))}
      </div>
    </section>
  );
};

export default PageSelector;
