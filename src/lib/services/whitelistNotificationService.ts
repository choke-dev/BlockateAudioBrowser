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
  private static instance: WhitelistNotificationService | null = null;
  
  private isListening = false;
  private visibleInterval: number | null = null;
  private hiddenInterval: number | null = null;
  private lastChecked: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private basePollingInterval = 30000; // 30 seconds (visible)
  private hiddenPollingInterval = 60000; // 60 seconds (hidden)
  private currentPollingInterval = this.basePollingInterval;
  private isCheckingForUpdates = false; // Prevent parallel requests
  private visibilityChangeHandler: (() => void) | null = null;
  
  // Dual timer state for visible/hidden intervals (like speed chess)
  private visibleTimerState = {
    startTime: 0,
    remainingTime: this.basePollingInterval,
    isPaused: false
  };
  private hiddenTimerState = {
    startTime: 0,
    remainingTime: this.hiddenPollingInterval,
    isPaused: true // Start paused since we begin visible
  };

  // Private constructor to prevent direct instantiation
  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): WhitelistNotificationService {
    if (!WhitelistNotificationService.instance) {
      WhitelistNotificationService.instance = new WhitelistNotificationService();
    }
    return WhitelistNotificationService.instance;
  }

  /**
   * Reset the singleton instance (for testing/cleanup)
   */
  public static resetInstance(): void {
    if (WhitelistNotificationService.instance) {
      WhitelistNotificationService.instance.stopListening();
      WhitelistNotificationService.instance = null;
    }
  }

  /**
   * Start listening for whitelist status by polling
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
    
    // Start with visible timer (assuming tab is visible initially)
    this.startVisibleTimer();

    // Set up visibility change handling
    this.setupVisibilityHandling();
  }

  /**
   * Start the visible timer (normal polling when tab is visible)
   */
  private startVisibleTimer() {
    // Clear any existing visible interval
    if (this.visibleInterval) {
      clearInterval(this.visibleInterval);
    }

    const interval = this.visibleTimerState.isPaused ? this.visibleTimerState.remainingTime : this.basePollingInterval;
    this.visibleTimerState.startTime = Date.now();
    this.visibleTimerState.isPaused = false;
    
    this.visibleInterval = window.setInterval(() => {
      if (!this.isCheckingForUpdates) {
        this.checkForUpdates();
      }
      this.visibleTimerState.startTime = Date.now();
      this.visibleTimerState.remainingTime = this.basePollingInterval;
    }, interval);
  }

  /**
   * Start the hidden timer (slower polling when tab is hidden)
   */
  private startHiddenTimer() {
    // Clear any existing hidden interval
    if (this.hiddenInterval) {
      clearInterval(this.hiddenInterval);
    }

    const interval = this.hiddenTimerState.isPaused ? this.hiddenTimerState.remainingTime : this.hiddenPollingInterval;
    this.hiddenTimerState.startTime = Date.now();
    this.hiddenTimerState.isPaused = false;
    
    this.hiddenInterval = window.setInterval(() => {
      if (!this.isCheckingForUpdates) {
        this.checkForUpdates();
      }
      this.hiddenTimerState.startTime = Date.now();
      this.hiddenTimerState.remainingTime = this.hiddenPollingInterval;
    }, interval);
  }

  /**
   * Pause the visible timer and start the hidden timer
   */
  private pauseVisibleStartHidden() {
    if (this.visibleInterval && !this.visibleTimerState.isPaused) {
      const elapsed = Date.now() - this.visibleTimerState.startTime;
      this.visibleTimerState.remainingTime = Math.max(0, this.basePollingInterval - elapsed);
      
      clearInterval(this.visibleInterval);
      this.visibleInterval = null;
      this.visibleTimerState.isPaused = true;
    }
    
    // Start hidden timer
    this.startHiddenTimer();
  }

  /**
   * Pause the hidden timer and start the visible timer
   */
  private pauseHiddenStartVisible() {
    if (this.hiddenInterval && !this.hiddenTimerState.isPaused) {
      const elapsed = Date.now() - this.hiddenTimerState.startTime;
      this.hiddenTimerState.remainingTime = Math.max(0, this.hiddenPollingInterval - elapsed);
      
      clearInterval(this.hiddenInterval);
      this.hiddenInterval = null;
      this.hiddenTimerState.isPaused = true;
    }
    
    // Start visible timer
    this.startVisibleTimer();
  }

  /**
   * Stop listening for updates
   */
  stopListening() {

    // Clear both timers
    if (this.visibleInterval) {
      clearInterval(this.visibleInterval);
      this.visibleInterval = null;
    }
    
    if (this.hiddenInterval) {
      clearInterval(this.hiddenInterval);
      this.hiddenInterval = null;
    }

    // Clean up visibility change handler
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    // Reset all state
    this.isListening = false;
    this.isCheckingForUpdates = false;
    this.reconnectAttempts = 0;
    this.currentPollingInterval = this.basePollingInterval;
    
    // Reset timer states
    this.visibleTimerState = {
      startTime: 0,
      remainingTime: this.basePollingInterval,
      isPaused: false
    };
    this.hiddenTimerState = {
      startTime: 0,
      remainingTime: this.hiddenPollingInterval,
      isPaused: true
    };
  }

  /**
   * Check for new whitelist status updates via API
   */
  private async checkForUpdates() {
    // Prevent parallel requests
    if (this.isCheckingForUpdates) {
      return;
    }

    this.isCheckingForUpdates = true;

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
      this.handleConnectionError();
    } finally {
      this.isCheckingForUpdates = false;
    }
  }

  /**
   * Handle incoming status updates
   */
  private async handleStatusUpdate(update: WhitelistStatusUpdate) {

    // Get current notification settings
    const notificationState = notifications.getCurrentState();

    if (notificationState.enabled && notificationState.permission.status === 'granted') {
      // Show browser notification (this also adds to history)
      notifications.showNotification({
        audioId: update.audioId,
        audioName: update.name,
        status: update.status.toLowerCase() as 'approved' | 'rejected'
      });
    } else {
      // Only add to notification history if browser notifications are disabled
      const timestamp = Date.now();
      const status = update.status.toLowerCase() as 'approved' | 'rejected';
      const notificationToAdd = {
        id: `${update.audioId}-${status}-${timestamp}`,
        audioId: update.audioId,
        audioName: update.name,
        status: status,
        timestamp: update.updatedAt,
        read: false
      };
      notifications.addNotification(notificationToAdd);
    }
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

    // Clean up any existing handler
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    this.visibilityChangeHandler = () => {

      if (document.hidden) {
        this.pauseVisibleStartHidden();
      } else {
        this.pauseHiddenStartVisible();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
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

// Export singleton instance
export const whitelistNotificationService = WhitelistNotificationService.getInstance();

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