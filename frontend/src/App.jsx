import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';
import './App.css';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  const MAX_FILES = 5;

  const handleFilesSelected = (files) => {
    if (downloadUrl) setDownloadUrl('');
    if (selectedFiles.length + files.length > MAX_FILES) {
      alert(`You can only select a maximum of ${MAX_FILES} files.`);
      return;
    }
    const pdfFiles = files.filter(file => file.type === "application/pdf");
    setSelectedFiles(prevFiles => [...prevFiles, ...pdfFiles]);
  };

  const handleRemoveFile = (fileIndex) => {
    if (downloadUrl) setDownloadUrl('');
    setSelectedFiles(prevFiles => prevFiles.filter((_, index) => index !== fileIndex));
  };

  const handleCombine = async () => {
    setIsLoading(true);
    setDownloadUrl('');

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('http://127.0.0.1:5000/api/combine', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Server response was not ok.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      setDownloadUrl(url); 
      setSelectedFiles([]);

    } catch (error) {
      console.error('Error combining PDFs:', error);
      alert('Failed to combine PDFs. Please check the console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>PDF Combiner 📄</h1>
        <p>Select up to {MAX_FILES} PDF files to merge into one.</p>
      </header>

      <main className="app-main">
        {downloadUrl ? (
          <div className="download-container">
            <h3>Your file is ready!</h3>
            {/* NEW div wrapper for the buttons */}
            <div className="download-actions">
              <a 
                href={downloadUrl} 
                download="combined.pdf" 
                className="download-button"
              >
                Download
              </a>
              <button 
                onClick={() => setDownloadUrl('')} 
                className="start-over-button"
              >
                Start Over
              </button>
            </div>
          </div>
        ) : (
          <>
            <FileUpload onFilesSelected={handleFilesSelected} />

            <div className="file-list-container">
              <h2>Selected Files: ({selectedFiles.length}/{MAX_FILES})</h2>
              {selectedFiles.length > 0 ? (
                <FileList files={selectedFiles} onRemoveFile={handleRemoveFile} />
              ) : (
                <p>No files selected yet.</p>
              )}
            </div>

            <button
              className="combine-button"
              onClick={handleCombine}
              disabled={selectedFiles.length === 0 || isLoading}
            >
              {isLoading ? 'Combining...' : 'Combine PDFs'}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default App;