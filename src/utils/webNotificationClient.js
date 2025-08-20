
// Client-side JavaScript for web notifications
// Include this in your admin and vendor panel HTML

class WebNotificationClient {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || `ws://localhost:3000/ws/notifications`;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectAttempts = 0;
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.authToken = options.authToken || null;
    
    this.init();
  }

  init() {
    this.requestNotificationPermission();
    this.connect();
  }

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  connect() {
    try {
      const wsUrl = this.authToken 
        ? `${this.wsUrl}?token=${this.authToken}`
        : this.wsUrl;
        
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('Connected to notification service');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      this.socket.onclose = () => {
        console.log('Disconnected from notification service');
        this.isConnected = false;
        this.emit('disconnected');
        this.reconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Error connecting to notification service:', error);
      this.reconnect();
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  handleMessage(data) {
    switch (data.type) {
      case 'notification':
        this.handleNotification(data.data);
        break;
      case 'browser_notification':
        this.showBrowserNotification(data.data);
        break;
      case 'connected':
        this.emit('connected', data);
        break;
      case 'pong':
        this.emit('pong', data);
        break;
      case 'notification_read':
        this.emit('notification_read', data);
        break;
      case 'error':
        this.emit('error', data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  handleNotification(notification) {
    console.log('Received notification:', notification);
    
    // Update UI
    this.updateNotificationUI(notification);
    
    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      this.showBrowserNotification({
        title: notification.title,
        body: notification.message,
        icon: this.getIconForType(notification.type),
        data: notification.data
      });
    }

    this.emit('notification', notification);
  }

  showBrowserNotification(data) {
    if (Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      requireInteraction: data.requireInteraction,
      actions: data.actions,
      data: data.data,
      tag: data.tag
    });

    notification.onclick = () => {
      window.focus();
      this.emit('notification_click', data);
      notification.close();
    };

    // Auto close after 5 seconds if not requiring interaction
    if (!data.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  updateNotificationUI(notification) {
    // Update notification badge
    this.updateNotificationBadge();
    
    // Add to notification list if container exists
    const notificationList = document.getElementById('notification-list');
    if (notificationList) {
      const notificationElement = this.createNotificationElement(notification);
      notificationList.insertBefore(notificationElement, notificationList.firstChild);
    }

    // Show toast notification
    this.showToast(notification);
  }

  createNotificationElement(notification) {
    const element = document.createElement('div');
    element.className = `notification notification-${notification.type}`;
    element.setAttribute('data-notification-id', notification.id);
    
    element.innerHTML = `
      <div class="notification-icon">
        ${this.getIconForType(notification.type)}
      </div>
      <div class="notification-content">
        <div class="notification-title">${notification.title}</div>
        <div class="notification-message">${notification.message}</div>
        <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
      </div>
      <div class="notification-actions">
        <button class="mark-read-btn" onclick="notificationClient.markAsRead('${notification.id}')">
          Mark as Read
        </button>
        <button class="close-btn" onclick="this.parentElement.parentElement.remove()">
          ×
        </button>
      </div>
    `;

    return element;
  }

  showToast(notification) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
      `;
      document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${notification.type}`;
    toast.style.cssText = `
      background: white;
      border-left: 4px solid ${this.getColorForType(notification.type)};
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 10px;
      animation: slideIn 0.3s ease-out;
    `;
    
    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start;">
        <div style="margin-right: 12px; font-size: 20px;">
          ${this.getIconForType(notification.type)}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px;">${notification.title}</div>
          <div style="color: #666; font-size: 14px;">${notification.message}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: none; border: none; font-size: 18px; cursor: pointer; color: #999;">
          ×
        </button>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 5000);
  }

  updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
      const currentCount = parseInt(badge.textContent) || 0;
      badge.textContent = currentCount + 1;
      badge.style.display = 'inline';
    }
  }

  getIconForType(type) {
    const icons = {
      info: '🔔',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type] || icons.info;
  }

  getColorForType(type) {
    const colors = {
      info: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    };
    return colors[type] || colors.info;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  // Public methods
  markAsRead(notificationId) {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({
        type: 'mark_read',
        notificationId: notificationId
      }));
    }
  }

  ping() {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get auth token from localStorage or cookie
  const authToken = localStorage.getItem('auth_token') || getCookie('auth_token');
  
  window.notificationClient = new WebNotificationClient({
    authToken: authToken,
    wsUrl: `ws://${window.location.host}/ws/notifications`
  });

  // Example event listeners
  window.notificationClient.on('notification', (notification) => {
    console.log('New notification received:', notification);
  });

  window.notificationClient.on('connected', () => {
    console.log('Connected to notification service');
  });

  window.notificationClient.on('disconnected', () => {
    console.log('Disconnected from notification service');
  });
});

// Helper function to get cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .notification {
    display: flex;
    align-items: flex-start;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    background: white;
    border: 1px solid #e5e5e5;
    transition: all 0.2s ease;
  }
  
  .notification:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .notification-info { border-left: 4px solid #3b82f6; }
  .notification-success { border-left: 4px solid #10b981; }
  .notification-warning { border-left: 4px solid #f59e0b; }
  .notification-error { border-left: 4px solid #ef4444; }
  
  .notification-icon {
    margin-right: 12px;
    font-size: 20px;
  }
  
  .notification-content {
    flex: 1;
  }
  
  .notification-title {
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .notification-message {
    color: #666;
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .notification-time {
    color: #999;
    font-size: 12px;
  }
  
  .notification-actions {
    display: flex;
    gap: 8px;
  }
  
  .mark-read-btn, .close-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .mark-read-btn:hover {
    background: #f0f9ff;
    border-color: #3b82f6;
    color: #3b82f6;
  }
  
  .close-btn:hover {
    background: #fef2f2;
    border-color: #ef4444;
    color: #ef4444;
  }
`;
document.head.appendChild(style);
