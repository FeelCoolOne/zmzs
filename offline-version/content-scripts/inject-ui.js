(function() {
  'use strict';

  console.log('社媒助手: 页面注入脚本已加载');

  function createFloatingButton() {
    const button = document.createElement('div');
    button.id = 'smzs-collect-btn';
    button.innerHTML = `
      <div class="smzs-btn-content">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>采集当前页面</span>
      </div>
    `;
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    button.addEventListener('click', () => {
      window.postMessage({
        type: 'SMZS_COLLECT_PAGE',
        data: {
          url: window.location.href,
          title: document.title
        }
      }, '*');
    });

    document.body.appendChild(button);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      const messageData = event.data;
      if (!messageData) return;

      const type = messageData.type;
      const data = messageData.data;

      if (type === 'SMZS_COLLECT_RESPONSE') {
        if (data && data.success) {
          showNotification('采集成功！', 'success');
        } else {
          showNotification('采集失败：' + (data && data.error ? data.error : '未知错误'), 'error');
        }
      }
    });
  }

  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = 'smzs-notification smzs-notification-' + type;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 99999;
      background: ${type === 'success' ? '#52c41a' : '#ff4d4f'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: smzsSlideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'smzsSlideOut 0.3s ease-out';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 2000);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes smzsSlideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes smzsSlideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .smzs-btn-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .smzs-btn-content svg {
      width: 16px;
      height: 16px;
    }

    .smzs-notification {
      z-index: 99999;
    }
  `;
  document.head.appendChild(style);

  createFloatingButton();
  console.log('社媒助手: 页面注入完成，采集按钮已添加');
})();
