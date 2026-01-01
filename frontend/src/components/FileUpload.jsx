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
        accept=".pdf,image/png,image/jpeg,image/jpg,image/heic,image/heif,image/webp,image/tiff,image/x-tiff,image/*" // Allow PDFs and common image formats
        onChange={handleFileChange}
        className="file-input"
      />
      <label htmlFor="file-input" className="file-label">
        Click to Browse or Drag & Drop PDFs or Images Here
      </label>
    </div>
  );
};

export default FileUpload;
