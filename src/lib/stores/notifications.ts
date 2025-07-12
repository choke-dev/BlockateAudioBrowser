import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { auth } from './auth.js';

export interface NotificationPermission {
  status: 'default' | 'granted' | 'denied';
  supported: boolean;
}

export interface WhitelistNotification {
  id: string;
  audioId: string;
  audioName: string;
  status: 'approved' | 'rejected';
  timestamp: string;
  read: boolean;
}

interface NotificationState {
  permission: NotificationPermission;
  enabled: boolean;
  notifications: WhitelistNotification[];
  isListening: boolean;
}

const initialState: NotificationState = {
  permission: {
    status: 'default',
    supported: false
  },
  enabled: false,
  notifications: [],
  isListening: false
};

function createNotificationStore() {
  const { subscribe, set, update } = writable<NotificationState>(initialState);

  return {
    subscribe,

    /**
     * Initialize notification system
     */
    async init() {
      if (!browser) return;

      const supported = 'Notification' in window;
      const status = supported ? Notification.permission : 'denied';

      update(state => ({
        ...state,
        permission: { status, supported },
        enabled: status === 'granted' && this.getStoredPreference()
      }));

      // Load stored notifications
      this.loadStoredNotifications();
    },

    /**
     * Request notification permission
     */
    async requestPermission(): Promise<boolean> {
      if (!browser || !('Notification' in window)) {
        return false;
      }

      try {
        const permission = await Notification.requestPermission();
        
        update(state => ({
          ...state,
          permission: { ...state.permission, status: permission },
          enabled: permission === 'granted'
        }));

        if (permission === 'granted') {
          this.setStoredPreference(true);
          return true;
        } else {
          this.setStoredPreference(false);
          return false;
        }
      } catch (error) {
        console.error('Failed to request notification permission:', error);
        return false;
      }
    },

    /**
     * Enable/disable notifications
     */
    async setEnabled(enabled: boolean) {
      if (!browser) return false;

      if (enabled && !('Notification' in window)) {
        console.warn('Notifications not supported in this browser');
        return false;
      }

      if (enabled && Notification.permission !== 'granted') {
        const granted = await this.requestPermission();
        if (!granted) return false;
      }

      update(state => ({ ...state, enabled }));
      this.setStoredPreference(enabled);
      return true;
    },

    /**
     * Show a browser notification
     */
    showNotification(notification: Omit<WhitelistNotification, 'id' | 'timestamp' | 'read'>) {
      console.log('🔔 [NOTIFICATION DEBUG] showNotification called:', {
        audioId: notification.audioId,
        audioName: notification.audioName,
        status: notification.status,
        stackTrace: new Error().stack
      });

      if (!browser || !('Notification' in window) || Notification.permission !== 'granted') {
        console.log('🔔 [NOTIFICATION DEBUG] Browser notification skipped:', {
          browser,
          notificationSupported: 'Notification' in window,
          permission: browser && 'Notification' in window ? Notification.permission : 'unknown'
        });
        return;
      }

      const title = notification.status === 'approved'
        ? '✅ Whitelist request approved!'
        : '❌ Whitelist request rejected';
      
      const body = `Your request for "${notification.audioName}" (ID: ${notification.audioId}) has been ${notification.status}.`;

      console.log('🔔 [NOTIFICATION DEBUG] Creating browser notification:', { title, body });

      const browserNotification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `whitelist-${notification.audioId}`,
        requireInteraction: true,
        data: {
          audioId: notification.audioId,
          status: notification.status
        }
      });

      // Auto-close after 10 seconds
      setTimeout(() => {
        browserNotification.close();
      }, 10000);

      // Handle click to focus window
      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
      };

      // Store the notification with a more robust ID generation
      const timestamp = Date.now();
      const fullNotification: WhitelistNotification = {
        id: `${notification.audioId}-${notification.status}-${timestamp}`,
        ...notification,
        timestamp: new Date().toISOString(),
        read: false
      };

      console.log('🔔 [NOTIFICATION DEBUG] Adding notification to store:', fullNotification);
      this.addNotification(fullNotification);
    },

    /**
     * Add notification to store
     */
    addNotification(notification: WhitelistNotification) {
      console.log('🔔 [NOTIFICATION DEBUG] addNotification called:', {
        id: notification.id,
        audioId: notification.audioId,
        status: notification.status,
        stackTrace: new Error().stack
      });

      update(state => {
        // Check for duplicates by ID
        const exists = state.notifications.some(n => n.id === notification.id);
        if (exists) {
          console.warn('🔔 [NOTIFICATION DEBUG] Duplicate notification prevented:', {
            id: notification.id,
            existingNotifications: state.notifications.map(n => ({ id: n.id, audioId: n.audioId, status: n.status }))
          });
          return state;
        }
        
        console.log('🔔 [NOTIFICATION DEBUG] Adding new notification to store:', {
          newNotification: notification,
          currentCount: state.notifications.length
        });
        
        return {
          ...state,
          notifications: [notification, ...state.notifications].slice(0, 50) // Keep last 50
        };
      });
      this.saveStoredNotifications();
    },

    /**
     * Mark notification as read
     */
    markAsRead(notificationId: string) {
      update(state => ({
        ...state,
        notifications: state.notifications.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      }));
      this.saveStoredNotifications();
    },

    /**
     * Mark all notifications as read
     */
    markAllAsRead() {
      update(state => ({
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true }))
      }));
      this.saveStoredNotifications();
    },

    /**
     * Clear all notifications
     */
    clearAll() {
      update(state => ({ ...state, notifications: [] }));
      this.saveStoredNotifications();
    },

    /**
     * Handle permission change (when user changes it in browser settings)
     */
    handlePermissionChange() {
      if (!browser || !('Notification' in window)) return;

      const newStatus = Notification.permission;
      update(state => {
        const wasEnabled = state.enabled;
        const shouldDisable = newStatus !== 'granted' && wasEnabled;
        
        if (shouldDisable) {
          this.setStoredPreference(false);
        }

        return {
          ...state,
          permission: { ...state.permission, status: newStatus },
          enabled: newStatus === 'granted' && this.getStoredPreference()
        };
      });
    },

    /**
     * Get stored preference
     */
    getStoredPreference(): boolean {
      if (!browser) return false;
      return localStorage.getItem('notifications-enabled') === 'true';
    },

    /**
     * Set stored preference
     */
    setStoredPreference(enabled: boolean) {
      if (!browser) return;
      localStorage.setItem('notifications-enabled', enabled.toString());
    },

    /**
     * Load stored notifications
     */
    loadStoredNotifications() {
      if (!browser) return;
      
      console.log('🔔 [NOTIFICATION DEBUG] loadStoredNotifications called:', {
        stackTrace: new Error().stack
      });
      
      try {
        const stored = localStorage.getItem('whitelist-notifications');
        if (stored) {
          const notifications = JSON.parse(stored);
          console.log('🔔 [NOTIFICATION DEBUG] Found stored notifications:', {
            count: notifications.length,
            notifications: notifications.map((n: any) => ({ id: n.id, audioId: n.audioId, status: n.status }))
          });
          
          update(state => {
            // Only load if current notifications array is empty to prevent duplicates
            if (state.notifications.length === 0) {
              console.log('🔔 [NOTIFICATION DEBUG] Loading stored notifications into empty store');
              return { ...state, notifications };
            } else {
              console.log('🔔 [NOTIFICATION DEBUG] Skipping load - store already has notifications:', state.notifications.length);
            }
            return state;
          });
        } else {
          console.log('🔔 [NOTIFICATION DEBUG] No stored notifications found');
        }
      } catch (error) {
        console.error('🔔 [NOTIFICATION DEBUG] Failed to load stored notifications:', error);
      }
    },

    /**
     * Save notifications to localStorage
     */
    saveStoredNotifications() {
      if (!browser) return;

      try {
        const state = this.getCurrentState();
        localStorage.setItem('whitelist-notifications', JSON.stringify(state.notifications));
      } catch (error) {
        console.error('Failed to save notifications:', error);
      }
    },

    /**
     * Get current state (for internal use)
     */
    getCurrentState(): NotificationState {
      let currentState: NotificationState = initialState;
      const unsubscribe = subscribe(state => { currentState = state; });
      unsubscribe(); // Immediately unsubscribe to prevent memory leaks
      return currentState;
    }
  };
}

export const notifications = createNotificationStore();

// Derived store for unread count
export const unreadCount = derived(
  notifications,
  $notifications => $notifications.notifications.filter(n => !n.read).length
);

// Derived store for checking if notifications are available
export const notificationsAvailable = derived(
  [notifications, auth],
  ([$notifications, $auth]) => 
    $auth.authenticated && $notifications.permission.supported
);