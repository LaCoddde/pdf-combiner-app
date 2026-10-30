import { useEffect, useRef, useState } from 'react';
import pdfjs from '../pdf';
import './FilePreview.css';

const isPdf = (file) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

const FilePreview = ({ file }) => {
  const canvasRef = useRef(null);
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    let renderTask;
    let localImageUrl = '';

    setImageUrl('');
    setStatus('loading');

    if (!isPdf(file)) {
      localImageUrl = URL.createObjectURL(file);
      setImageUrl(localImageUrl);
      return () => URL.revokeObjectURL(localImageUrl);
    }

    const renderFirstPage = async () => {
      try {
        const data = await file.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjs.getDocument({ data });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 96 / baseViewport.width });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) {
          await loadingTask.destroy();
          return;
        }

        const outputScale = 2;
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

        renderTask = page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;

        if (!cancelled) setStatus('ready');
        page.cleanup();
        await loadingTask.destroy();
      } catch (error) {
        if (!cancelled && error?.name !== 'RenderingCancelledException') {
          console.error(`Could not render preview for ${file.name}:`, error);
          setStatus('error');
        }
      }
    };

    renderFirstPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      loadingTask?.destroy();
    };
  }, [file]);

  return (
    <div className="file-preview" aria-label={`Preview of ${file.name}`}>
      {isPdf(file) ? (
        <canvas ref={canvasRef} className={status === 'ready' ? 'visible' : ''} />
      ) : (
        imageUrl && (
          <img
            src={imageUrl}
            alt=""
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('error')}
            className={status === 'ready' ? 'visible' : ''}
          />
        )
      )}
      {status !== 'ready' && (
        <span className="preview-placeholder" aria-hidden="true">
          {status === 'error' ? 'FILE' : '...'}
        </span>
      )}
    </div>
  );
};

export default FilePreview;
