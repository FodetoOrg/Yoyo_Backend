
// Client-side Web Push Notification Handler
// Include this in your admin and vendor panel HTML

class WebPushClient {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || '/api/web-push';
    this.authToken = options.authToken || null;
    this.registration = null;
    this.subscription = null;
    this.vapidPublicKey = null;
    
    this.init();
  }

  async init() {
    if (!('serviceWorker' in navigator)) {
      console.error('Service Worker not supported');
      return;
    }

    if (!('PushManager' in window)) {
      console.error('Web Push not supported');
      return;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');

      // Get VAPID public key
      await this.getVapidPublicKey();
      
      // Check existing subscription
      await this.checkExistingSubscription();
      
    } catch (error) {
      console.error('Failed to initialize Web Push client:', error);
    }
  }

  async getVapidPublicKey() {
    try {
      const response = await fetch(`${this.apiUrl}/vapid-public-key`);
      const data = await response.json();
      
      if (data.success) {
        this.vapidPublicKey = data.data.publicKey;
      }
    } catch (error) {
      console.error('Failed to get VAPID public key:', error);
    }
  }

  async checkExistingSubscription() {
    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      
      if (this.subscription) {
        console.log('Existing web push subscription found');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check existing subscription:', error);
      return false;
    }
  }

  async requestPermission() {
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }
    
    return permission;
  }

  async subscribe() {
    try {
      // Request notification permission
      await this.requestPermission();
      
      if (!this.vapidPublicKey) {
        await this.getVapidPublicKey();
      }

      // Create subscription
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      // Send subscription to server
      const response = await fetch(`${this.apiUrl}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          subscription: this.subscription.toJSON()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Successfully subscribed to web push notifications');
        return true;
      } else {
        throw new Error(data.message);
      }
      
    } catch (error) {
      console.error('Failed to subscribe to web push notifications:', error);
      throw error;
    }
  }

  async unsubscribe() {
    try {
      if (!this.subscription) {
        console.log('No active subscription to unsubscribe');
        return true;
      }

      // Unsubscribe from browser
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        // Remove subscription from server
        await fetch(`${this.apiUrl}/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({
            endpoint: this.subscription.endpoint
          })
        });

        this.subscription = null;
        console.log('Successfully unsubscribed from web push notifications');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Failed to unsubscribe from web push notifications:', error);
      throw error;
    }
  }

  async sendTestNotification(message) {
    try {
      const response = await fetch(`${this.apiUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Test notification sent successfully');
        return data;
      } else {
        throw new Error(data.message);
      }
      
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  isSubscribed() {
    return this.subscription !== null;
  }

  getSubscription() {
    return this.subscription;
  }

  // Helper function to convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  const authToken = localStorage.getItem('auth_token') || getCookie('auth_token');
  
  window.webPushClient = new WebPushClient({
    authToken: authToken
  });

  // Add subscribe button functionality
  const subscribeBtn = document.getElementById('web-push-subscribe');
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', async () => {
      try {
        subscribeBtn.disabled = true;
        subscribeBtn.textContent = 'Subscribing...';
        
        await window.webPushClient.subscribe();
        
        subscribeBtn.textContent = 'Subscribed ✓';
        subscribeBtn.style.background = '#10b981';
        
        // Show unsubscribe button
        const unsubscribeBtn = document.getElementById('web-push-unsubscribe');
        if (unsubscribeBtn) {
          unsubscribeBtn.style.display = 'inline-block';
        }
        
      } catch (error) {
        subscribeBtn.disabled = false;
        subscribeBtn.textContent = 'Subscribe Failed';
        subscribeBtn.style.background = '#ef4444';
        
        setTimeout(() => {
          subscribeBtn.textContent = 'Enable Web Push';
          subscribeBtn.style.background = '';
        }, 3000);
      }
    });
  }

  // Add unsubscribe button functionality
  const unsubscribeBtn = document.getElementById('web-push-unsubscribe');
  if (unsubscribeBtn) {
    unsubscribeBtn.addEventListener('click', async () => {
      try {
        await window.webPushClient.unsubscribe();
        
        unsubscribeBtn.style.display = 'none';
        
        const subscribeBtn = document.getElementById('web-push-subscribe');
        if (subscribeBtn) {
          subscribeBtn.disabled = false;
          subscribeBtn.textContent = 'Enable Web Push';
          subscribeBtn.style.background = '';
        }
        
      } catch (error) {
        console.error('Failed to unsubscribe:', error);
      }
    });
  }

  // Add test notification button
  const testBtn = document.getElementById('web-push-test');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      try {
        await window.webPushClient.sendTestNotification('This is a test web push notification!');
      } catch (error) {
        console.error('Failed to send test notification:', error);
      }
    });
  }
});

// Helper function to get cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
