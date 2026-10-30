import { useEffect, useState } from 'react';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';
import './App.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const COMBINE_API_URL = `${API_BASE_URL}/api/combine`;
const COMPRESS_API_URL = `${API_BASE_URL}/api/compress`;

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

function App() {
  const [mode, setMode] = useState('combine');
  const [selectedFiles, setSelectedFiles] = useState([]);
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
    setMode(nextMode);
  };

  const handleFilesSelected = (files) => {
    clearDownload();

    if (mode === 'compress') {
      const pdfFiles = files.filter(isPdf);
      const rejected = files.filter((file) => !isPdf(file));

      if (rejected.length) {
        alert(`Compression currently supports PDFs only. Skipped: ${rejected.map((file) => file.name).join(', ')}`);
      }
      if (pdfFiles.length > 1) {
        alert('Please compress one PDF at a time. The first PDF was selected.');
      }
      if (pdfFiles.length) setSelectedFiles([pdfFiles[0]]);
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
  };

  const handleProcess = async () => {
    setIsLoading(true);
    clearDownload();

    const formData = new FormData();
    if (mode === 'compress') {
      formData.append('file', selectedFiles[0]);
    } else {
      selectedFiles.forEach((file) => formData.append('files', file));
    }

    try {
      const response = await fetch(mode === 'compress' ? COMPRESS_API_URL : COMBINE_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'The server could not process the file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const originalSize = Number(response.headers.get('X-Original-Size'));
      const compressedSize = Number(response.headers.get('X-Compressed-Size'));
      const savingsPercent = Number(response.headers.get('X-Savings-Percent'));

      setDownload({
        url,
        filename: mode === 'compress'
          ? `${selectedFiles[0].name.replace(/\.pdf$/i, '')}-compressed.pdf`
          : 'combined.pdf',
        originalSize,
        compressedSize,
        savingsPercent,
        mode,
      });
      setSelectedFiles([]);
    } catch (error) {
      console.error(`Error ${mode === 'compress' ? 'compressing' : 'combining'} PDF:`, error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isCompressMode = mode === 'compress';

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>PDF Toolkit 📄</h1>
        <p>Combine documents or make a PDF smaller.</p>
      </header>

      <div className="mode-switcher" aria-label="Choose a PDF tool">
        <button
          type="button"
          className={`mode-button ${mode === 'combine' ? 'active' : ''}`}
          onClick={() => handleModeChange('combine')}
          aria-pressed={mode === 'combine'}
        >
          Combine
        </button>
        <button
          type="button"
          className={`mode-button ${isCompressMode ? 'active' : ''}`}
          onClick={() => handleModeChange('compress')}
          aria-pressed={isCompressMode}
        >
          Compress
        </button>
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
              <h2>{isCompressMode ? 'Compress a PDF' : 'Combine files'}</h2>
              <p>
                {isCompressMode
                  ? 'Reduces file size while keeping text sharp and images readable. Already optimized PDFs may not shrink.'
                  : 'Merge PDFs and common image formats into one PDF in the order selected.'}
              </p>
            </div>

            <FileUpload
              onFilesSelected={handleFilesSelected}
              accept={isCompressMode ? '.pdf,application/pdf' : '.pdf,image/*'}
              multiple={!isCompressMode}
              label={isCompressMode ? 'Choose one PDF to compress' : 'Choose PDFs or images to combine'}
            />

            <div className="file-list-container">
              <h2>Selected {isCompressMode ? 'PDF' : `Files (${selectedFiles.length})`}</h2>
              {selectedFiles.length > 0 ? (
                <FileList files={selectedFiles} onRemoveFile={handleRemoveFile} />
              ) : (
                <p>No file selected yet.</p>
              )}
            </div>

            <button
              className="primary-action-button"
              onClick={handleProcess}
              disabled={selectedFiles.length === 0 || isLoading}
            >
              {isLoading
                ? (isCompressMode ? 'Compressing...' : 'Combining...')
                : (isCompressMode ? 'Compress PDF' : 'Combine Files')}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
