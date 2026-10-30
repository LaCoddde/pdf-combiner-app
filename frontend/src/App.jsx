import { useEffect, useState } from 'react';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';
import PageSelector from './components/PageSelector';
import './App.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const API_URLS = {
  combine: `${API_BASE_URL}/api/combine`,
  compress: `${API_BASE_URL}/api/compress`,
  extract: `${API_BASE_URL}/api/extract`,
};

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/tiff',
  'image/x-tiff',
];

const SUPPORTED_EXTENSIONS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'heic',
  'heif',
  'webp',
  'tif',
  'tiff',
];

const getExtension = (filename = '') =>
  filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';

const isPdf = (file) => file.type === 'application/pdf' || getExtension(file.name) === 'pdf';

const isSupportedFile = (file) =>
  SUPPORTED_MIME_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(getExtension(file.name));

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const MODE_CONTENT = {
  combine: {
    title: 'Combine files',
    description: 'Merge PDFs and common image formats into one PDF in the order selected.',
    uploadLabel: 'Choose PDFs or images to combine',
    action: 'Combine Files',
    loading: 'Combining...',
  },
  compress: {
    title: 'Compress a PDF',
    description: 'Reduces file size while keeping text sharp and images readable. Already optimized PDFs may not shrink.',
    uploadLabel: 'Choose one PDF to compress',
    action: 'Compress PDF',
    loading: 'Compressing...',
  },
  extract: {
    title: 'Extract pages',
    description: 'Choose the pages you want and save them as a new PDF without changing their quality.',
    uploadLabel: 'Choose one PDF to select pages from',
    action: 'Save Selected Pages',
    loading: 'Saving pages...',
  },
};

function App() {
  const [mode, setMode] = useState('combine');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [download, setDownload] = useState(null);

  useEffect(() => () => {
    if (download?.url) window.URL.revokeObjectURL(download.url);
  }, [download]);

  const clearDownload = () => setDownload(null);

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    clearDownload();
    setSelectedFiles([]);
    setSelectedPages([]);
    setMode(nextMode);
  };

  const handleFilesSelected = (files) => {
    clearDownload();

    if (mode !== 'combine') {
      const pdfFiles = files.filter(isPdf);
      const rejected = files.filter((file) => !isPdf(file));

      if (rejected.length) {
        alert(`This tool currently supports PDFs only. Skipped: ${rejected.map((file) => file.name).join(', ')}`);
      }
      if (pdfFiles.length > 1) {
        alert('Please choose one PDF at a time. The first PDF was selected.');
      }
      if (pdfFiles.length) {
        setSelectedFiles([pdfFiles[0]]);
        setSelectedPages([]);
      }
      return;
    }

    const validFiles = files.filter(isSupportedFile);
    const rejected = files.filter((file) => !isSupportedFile(file));

    if (rejected.length) {
      alert(`These files were skipped because they are not supported: ${rejected.map((file) => file.name).join(', ')}`);
    }
    if (validFiles.length) {
      setSelectedFiles((previousFiles) => [...previousFiles, ...validFiles]);
    }
  };

  const handleRemoveFile = (fileIndex) => {
    clearDownload();
    setSelectedFiles((previousFiles) => previousFiles.filter((_, index) => index !== fileIndex));
    if (mode === 'extract') setSelectedPages([]);
  };

  const handleProcess = async () => {
    setIsLoading(true);
    clearDownload();

    const formData = new FormData();
    if (mode === 'combine') {
      selectedFiles.forEach((file) => formData.append('files', file));
    } else {
      formData.append('file', selectedFiles[0]);
      if (mode === 'extract') formData.append('pages', selectedPages.join(','));
    }

    try {
      const response = await fetch(API_URLS[mode], {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'The server could not process the file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const originalSizeHeader = response.headers.get('X-Original-Size');
      const compressedSizeHeader = response.headers.get('X-Compressed-Size');
      const savingsHeader = response.headers.get('X-Savings-Percent');
      const sourceName = selectedFiles[0]?.name.replace(/\.pdf$/i, '') || 'document';

      setDownload({
        url,
        filename: mode === 'compress'
          ? `${sourceName}-compressed.pdf`
          : mode === 'extract'
            ? `${sourceName}-selected-pages.pdf`
            : 'combined.pdf',
        originalSize: originalSizeHeader ? Number(originalSizeHeader) : null,
        compressedSize: compressedSizeHeader ? Number(compressedSizeHeader) : null,
        savingsPercent: savingsHeader ? Number(savingsHeader) : null,
        selectedPageCount: mode === 'extract' ? selectedPages.length : null,
        mode,
      });
      setSelectedFiles([]);
      setSelectedPages([]);
    } catch (error) {
      console.error(`Error processing PDF in ${mode} mode:`, error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isSinglePdfMode = mode !== 'combine';
  const content = MODE_CONTENT[mode];
  const actionDisabled =
    selectedFiles.length === 0 ||
    isLoading ||
    (mode === 'extract' && selectedPages.length === 0);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>PDF Toolkit 📄</h1>
        <p>Combine, compress, or save selected pages.</p>
      </header>

      <div className="mode-switcher" aria-label="Choose a PDF tool">
        {[
          ['combine', 'Combine'],
          ['compress', 'Compress'],
          ['extract', 'Extract Pages'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`mode-button ${mode === value ? 'active' : ''}`}
            onClick={() => handleModeChange(value)}
            aria-pressed={mode === value}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="app-main">
        {download ? (
          <div className="download-container" aria-live="polite">
            <h2>Your file is ready!</h2>
            {download.mode === 'compress' && (
              <div className="compression-result">
                <div>
                  <span>Before</span>
                  <strong>{formatFileSize(download.originalSize)}</strong>
                </div>
                <span className="result-arrow" aria-hidden="true">→</span>
                <div>
                  <span>After</span>
                  <strong>{formatFileSize(download.compressedSize)}</strong>
                </div>
                <p>
                  {download.savingsPercent > 0
                    ? `${download.savingsPercent.toFixed(1)}% smaller with high-quality compression.`
                    : 'This PDF was already optimized, so the original quality and size were preserved.'}
                </p>
              </div>
            )}
            {download.mode === 'extract' && (
              <p className="extract-result">
                Saved {download.selectedPageCount} selected {download.selectedPageCount === 1 ? 'page' : 'pages'} as a new PDF.
              </p>
            )}
            <div className="download-actions">
              <a href={download.url} download={download.filename} className="download-button">
                Download
              </a>
              <button type="button" onClick={clearDownload} className="start-over-button">
                Start Over
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="tool-description">
              <h2>{content.title}</h2>
              <p>{content.description}</p>
            </div>

            <FileUpload
              onFilesSelected={handleFilesSelected}
              accept={isSinglePdfMode ? '.pdf,application/pdf' : '.pdf,image/*'}
              multiple={!isSinglePdfMode}
              label={content.uploadLabel}
            />

            <div className="file-list-container">
              <h2>Selected {isSinglePdfMode ? 'PDF' : `Files (${selectedFiles.length})`}</h2>
              {selectedFiles.length > 0 ? (
                <FileList files={selectedFiles} onRemoveFile={handleRemoveFile} />
              ) : (
                <p>No file selected yet.</p>
              )}
            </div>

            {mode === 'extract' && selectedFiles[0] && (
              <PageSelector
                file={selectedFiles[0]}
                selectedPages={selectedPages}
                onSelectionChange={setSelectedPages}
              />
            )}

            <button
              className="primary-action-button"
              onClick={handleProcess}
              disabled={actionDisabled}
            >
              {isLoading ? content.loading : content.action}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
