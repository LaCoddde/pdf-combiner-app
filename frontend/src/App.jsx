// src/App.jsx

import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList'; // 1. Import FileList
import './App.css';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const MAX_FILES = 5;

  const handleFilesSelected = (files) => {
    if (selectedFiles.length + files.length > MAX_FILES) {
      alert(`You can only select a maximum of ${MAX_FILES} files.`);
      return;
    }
    const pdfFiles = files.filter(file => file.type === "application/pdf");
    setSelectedFiles(prevFiles => [...prevFiles, ...pdfFiles]);
  };

  // 2. Create function to remove a file
  const handleRemoveFile = (fileIndex) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, index) => index !== fileIndex));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>PDF Combiner 📄</h1>
        <p>Select up to {MAX_FILES} PDF files to merge into one.</p>
      </header>

      <main className="app-main">
        <FileUpload onFilesSelected={handleFilesSelected} />

        <div className="file-list-container">
          <h2>Selected Files: ({selectedFiles.length}/{MAX_FILES})</h2>
          {selectedFiles.length > 0 ? (
            // 3. Use the FileList component
            <FileList files={selectedFiles} onRemoveFile={handleRemoveFile} />
          ) : (
            <p>No files selected yet.</p>
          )}
        </div>

        {/* 4. Add 'disabled' attribute to the button */}
        <button
          className="combine-button"
          disabled={selectedFiles.length === 0}
        >
          Combine PDFs
        </button>
      </main>
    </div>
  );
}

export default App;