
// Service Worker for Web Push Notifications
// This file should be served from your public/static directory

const CACHE_NAME = 'hotel-booking-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming web push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push data:', data);

    const options = {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/badge.png',
      image: data.image,
      data: data.data,
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
      tag: data.tag || 'default',
      timestamp: data.data?.timestamp || Date.now(),
      vibrate: [200, 100, 200],
      sound: 'default'
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );

  } catch (error) {
    console.error('Error processing push notification:', error);
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: 'You have a new notification',
        icon: '/favicon.ico'
      })
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  
  if (action === 'dismiss') {
    console.log('Notification dismissed');
    return;
  }
  
  // Default action or 'view' action
  const urlToOpen = data.url || '/dashboard';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // Optional: Track notification dismissal
  const data = event.notification.data || {};
  if (data.trackClose) {
    // Send analytics event
    fetch('/api/analytics/notification-dismissed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notificationId: data.notificationId,
        userId: data.userId,
        timestamp: Date.now()
      })
    }).catch(console.error);
  }
});

// Background sync for offline notification handling
self.addEventListener('sync', (event) => {
  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  try {
    // Handle any pending notifications when back online
    console.log('Syncing notifications...');
  } catch (error) {
    console.error('Failed to sync notifications:', error);
  }
}
