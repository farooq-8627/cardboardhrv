import React from 'react';

function Footer() {
  return (
    <footer className="app-footer">
      <p>
        CardboardHRV - Research Project © {new Date().getFullYear()}
      </p>
      <p>
        <small>Powered by React.js and the Web Bluetooth API</small>
      </p>
    </footer>
  );
}

export default Footer; 