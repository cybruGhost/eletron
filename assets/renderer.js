window.addEventListener('DOMContentLoaded', async () => {
  const settings = await window.electronAPI.getSettings();
  const theme = settings.theme || 'light';
  const backgroundColor = theme === 'light' ? '#f0f0f0' : '#111';
  const textColor = theme === 'light' ? '#000' : '#fff';
  const accentColor = '#1E90FF';

  const isOnline = navigator.onLine;

  const titleBarHTML = `
    <style>
      .title-bar {
        -webkit-app-region: drag;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        background-color: ${backgroundColor};
        color: ${textColor};
        font-family: Arial, sans-serif;
        font-size: 12px;
        border-bottom: 1px solid ${theme === 'light' ? '#ddd' : '#333'};
        z-index: 9999;
      }
      .title-bar .title {
        flex: 1;
        text-align: center;
        font-weight: bold;
      }
      .control-btn {
        -webkit-app-region: no-drag;
        background: none;
        border: none;
        color: ${textColor};
        cursor: pointer;
        font-size: 14px;
        margin-left: 8px;
      }
      .control-btn:hover {
        color: ${accentColor};
      }
      body {
        margin-top: 30px !important;
      }
    </style>
    <div class="title-bar">
      <div class="title">The Cube</div>
      <div>
        <button class="control-btn" id="refresh-btn">↻</button>
        <button class="control-btn" id="reload-btn">⟳</button>
        <button class="control-btn" id="settings-btn">⚙</button>
      </div>
    </div>
  `;

  const titleBarContainer = document.createElement('div');
  titleBarContainer.innerHTML = titleBarHTML;
  document.body.prepend(titleBarContainer);

  document.getElementById('refresh-btn').addEventListener('click', () => window.location.reload());
  document.getElementById('reload-btn').addEventListener('click', () => (window.location.href = 'https://thecub4.vercel.app'));
  document.getElementById('settings-btn').addEventListener('click', () => window.electronAPI.openSettings());

  // Optional welcome message
  window.showWelcomeMessage = (message) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 15px;
      background: ${backgroundColor};
      color: ${textColor};
      border: 1px solid ${theme === 'light' ? '#ccc' : '#444'};
      border-radius: 5px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  };
});

