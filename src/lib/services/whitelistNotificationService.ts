import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth.js';
import { notifications } from '$lib/stores/notifications.js';

interface WhitelistStatusUpdate {
  requestId: string;
  audioId: string;
  name: string;
  status: 'APPROVED' | 'REJECTED';
  updatedAt: string;
}

class WhitelistNotificationService {
  private isListening = false;
  private pollInterval: number | null = null;
  private lastChecked: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private basePollingInterval = 30000; // 30 seconds
  private currentPollingInterval = this.basePollingInterval;

  /**
   * Start listening for whitelist status updates using secure polling
   */
  async startListening() {
    if (!browser || this.isListening) {
      return;
    }

    // Check if user is authenticated
    const authState = auth.getCurrentState();
    if (!authState.authenticated) {
      return;
    }

    this.isListening = true;
    this.lastChecked = new Date().toISOString();
        
    // Initial check
    await this.checkForUpdates();
    
    // Set up polling interval
    this.pollInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, this.currentPollingInterval);

    // Set up visibility change handling
    this.setupVisibilityHandling();
  }

  /**
   * Stop listening for updates
   */
  stopListening() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isListening = false;
    this.reconnectAttempts = 0;
    this.currentPollingInterval = this.basePollingInterval;
  }

  /**
   * Check for new whitelist status updates via secure API
   */
  private async checkForUpdates() {
    try {
      // Check if user is still authenticated
      const authState = auth.getCurrentState();
      if (!authState.authenticated) {
        this.stopListening();
        return;
      }

      const url = new URL('/api/whitelist/notifications', window.location.origin);
      if (this.lastChecked) {
        url.searchParams.set('since', this.lastChecked);
      }

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // User is no longer authenticated
          this.stopListening();
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        
        for (const update of result.data) {
          await this.handleStatusUpdate(update);
        }
        
        // Update last checked timestamp
        this.lastChecked = new Date().toISOString();
      }

      // Reset reconnection attempts on successful check
      this.reconnectAttempts = 0;
      this.currentPollingInterval = this.basePollingInterval;

    } catch (error) {
      console.error('❌ Failed to check for whitelist updates:', error);
      this.handleConnectionError();
    }
  }

  /**
   * Handle incoming status updates
   */
  private async handleStatusUpdate(update: WhitelistStatusUpdate) {

    // Get current notification settings
    const notificationState = notifications.getCurrentState();
    
    if (notificationState.enabled && notificationState.permission.status === 'granted') {
      // Show browser notification
      notifications.showNotification({
        audioId: update.audioId,
        audioName: update.name,
        status: update.status.toLowerCase() as 'approved' | 'rejected'
      });
    }

    // Always add to notification history (even if browser notifications are disabled)
    notifications.addNotification({
      id: `${update.requestId}-${Date.now()}`,
      audioId: update.audioId,
      audioName: update.name,
      status: update.status.toLowerCase() as 'approved' | 'rejected',
      timestamp: update.updatedAt,
      read: false
    });
  }

  /**
   * Handle connection errors and implement backoff strategy
   */
  private handleConnectionError() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached for whitelist notifications');
      this.stopListening();
      return;
    }

    this.reconnectAttempts++;
    
    // Exponential backoff for polling interval
    this.currentPollingInterval = Math.min(
      this.basePollingInterval * Math.pow(2, this.reconnectAttempts),
      300000 // Max 5 minutes
    );

  }

  /**
   * Set up visibility change handling for better performance
   */
  private setupVisibilityHandling() {
    if (!browser) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, reduce polling frequency
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = window.setInterval(() => {
            this.checkForUpdates();
          }, this.currentPollingInterval * 2); // Double the interval when hidden
        }
      } else {
        // Page is visible again, restore normal polling
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = window.setInterval(() => {
            this.checkForUpdates();
          }, this.currentPollingInterval);
        }
        // Check immediately when page becomes visible
        this.checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up event listener when service stops
    const originalStopListening = this.stopListening.bind(this);
    this.stopListening = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      originalStopListening();
    };
  }

  /**
   * Handle online/offline events
   */
  handleOnlineStatusChange() {
    if (!browser) return;

    if (navigator.onLine) {
      const authState = auth.getCurrentState();
      if (authState.authenticated && !this.isListening) {
        this.startListening();
      } else if (this.isListening) {
        // Check immediately when back online
        this.checkForUpdates();
      }
    } else {
      // Don't stop listening completely, just let the polling fail gracefully
    }
  }

  /**
   * Force check for updates (useful for manual refresh)
   */
  async forceCheck() {
    if (!this.isListening) {
      await this.startListening();
    } else {
      await this.checkForUpdates();
    }
  }

  /**
   * Get current service status
   */
  getStatus() {
    return {
      isListening: this.isListening,
      reconnectAttempts: this.reconnectAttempts,
      currentPollingInterval: this.currentPollingInterval,
      lastChecked: this.lastChecked
    };
  }
}

// Create singleton instance
export const whitelistNotificationService = new WhitelistNotificationService();

// Set up global event listeners for edge cases
if (browser) {
  // Handle online/offline status
  window.addEventListener('online', () => {
    whitelistNotificationService.handleOnlineStatusChange();
  });

  window.addEventListener('offline', () => {
    whitelistNotificationService.handleOnlineStatusChange();
  });

  // Handle permission changes (some browsers support this)
  if ('permissions' in navigator) {
    navigator.permissions.query({ name: 'notifications' as PermissionName }).then(permission => {
      permission.addEventListener('change', () => {
        notifications.handlePermissionChange();
      });
    }).catch(() => {
      // Permission API not fully supported, fallback to periodic checks
      setInterval(() => {
        notifications.handlePermissionChange();
      }, 5000);
    });
  }
}