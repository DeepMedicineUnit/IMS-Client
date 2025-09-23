import React from 'react';
import '../styles/loaders.css';

const Loader = ({ text }) => {
  return (
    <div className="loader-container">
      <div className="blob-loaders-blob-alt-7"></div>
      {text && <div className="loader-text">{text}</div>}
    </div>
  );
};

export default Loader;






