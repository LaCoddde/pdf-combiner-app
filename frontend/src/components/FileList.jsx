// src/components/FileList.jsx

import React from 'react';
import './FileList.css';

const FileList = ({ files, onRemoveFile }) => {
  return (
    <ul className="file-list-ul">
      {files.map((file, index) => (
        <li key={index} className="file-list-item">
          <span className="file-name">{file.name}</span>
          <button
            type="button"
            className="remove-file-button"
            onClick={() => onRemoveFile(index)}
          >
            &times; {/* This is the 'x' symbol */}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default FileList;