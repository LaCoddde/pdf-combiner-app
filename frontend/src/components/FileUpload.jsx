// src/components/FileUpload.jsx

import React from 'react';
import './FileUpload.css'; // We'll create this file next

const FileUpload = ({ onFilesSelected }) => {
  const handleFileChange = (event) => {
    // 'event.target.files' is a list of files the user selected
    const files = Array.from(event.target.files);
    onFilesSelected(files);
  };

  return (
    <div className="file-upload-container">
      <input
        type="file"
        id="file-input"
        multiple // Allows selecting multiple files
        accept=".pdf" // Restricts selection to only PDF files
        onChange={handleFileChange}
        className="file-input"
      />
      <label htmlFor="file-input" className="file-label">
        Click to Browse or Drag & Drop Files Here
      </label>
    </div>
  );
};

export default FileUpload;