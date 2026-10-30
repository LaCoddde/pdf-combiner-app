// src/components/FileList.jsx

import './FileList.css';
import FilePreview from './FilePreview';

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const FileList = ({ files, onRemoveFile }) => {
  return (
    <ul className="file-list-ul">
      {files.map((file, index) => (
        <li key={index} className="file-list-item">
          <FilePreview file={file} />
          <span className="file-details">
            <span className="file-name">{file.name}</span>
            <span className="file-size">{formatFileSize(file.size)}</span>
          </span>
          <button
            type="button"
            className="remove-file-button"
            onClick={() => onRemoveFile(index)}
            aria-label={`Remove ${file.name}`}
          >
            &times;
          </button>
        </li>
      ))}
    </ul>
  );
};

export default FileList;
