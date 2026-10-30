// src/components/FileUpload.jsx

import './FileUpload.css';

const FileUpload = ({ onFilesSelected, accept, multiple, label }) => {
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    onFilesSelected(files);
    event.target.value = '';
  };

  return (
    <div className="file-upload-container">
      <input
        type="file"
        id="file-input"
        multiple={multiple}
        accept={accept}
        onChange={handleFileChange}
        className="file-input"
      />
      <label htmlFor="file-input" className="file-label">
        {label}
      </label>
    </div>
  );
};

export default FileUpload;
