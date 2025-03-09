import React from 'react';

function Footer() {
  return (
    <footer className="app-footer">
      <p>
        CardboardHRV - Research Project © {new Date().getFullYear()}
      </p>
      <p>
        <small>Powered by SRM AP Reseach Students</small>
      </p>
    </footer>
  );
}

export default Footer; 