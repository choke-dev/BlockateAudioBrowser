import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface User {
  id: string;
  robloxId: string;
  username: string;
  avatar: string | null;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  authenticated: boolean;
  loading: boolean;
  requiresReauth: boolean;
}

const initialState: AuthState = {
  user: null,
  authenticated: false,
  loading: true,
  requiresReauth: false
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    
    /**
     * Initialize auth state by checking current session
     */
    async init() {
      if (!browser) return;
      
      update(state => ({ ...state, loading: true }));
      
      try {
        const response = await fetch('/api/oauth/user', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.authenticated && data.user) {
            set({
              user: data.user,
              authenticated: true,
              loading: false,
              requiresReauth: false
            });
          } else if (data.requiresReauth) {
            set({
              user: null,
              authenticated: false,
              loading: false,
              requiresReauth: true
            });
          } else {
            set({
              user: null,
              authenticated: false,
              loading: false,
              requiresReauth: false
            });
          }
        } else {
          set({
            user: null,
            authenticated: false,
            loading: false,
            requiresReauth: false
          });
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
        set({
          user: null,
          authenticated: false,
          loading: false,
          requiresReauth: false
        });
      }
    },

    /**
     * Start OAuth login flow
     */
    async login() {
      if (!browser) return;
      
      try {
        const response = await fetch('/api/oauth/roblox/login', {
          method: 'POST',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Redirect to OAuth authorization URL
            window.location.href = data.data;
          } else {
            throw new Error('Failed to get authorization URL');
          }
        } else {
          throw new Error('Login request failed');
        }
      } catch (error) {
        console.error('Login failed:', error);
        throw error;
      }
    },

    /**
     * Logout user
     */
    async logout() {
      if (!browser) return;
      
      try {
        const response = await fetch('/api/oauth/logout', {
          method: 'POST',
          credentials: 'include'
        });
        
        // Clear auth state regardless of response
        set({
          user: null,
          authenticated: false,
          loading: false,
          requiresReauth: false
        });
        
        if (!response.ok) {
          console.warn('Logout request failed, but cleared local state');
        }
      } catch (error) {
        console.error('Logout failed:', error);
        // Still clear local state
        set({
          user: null,
          authenticated: false,
          loading: false,
          requiresReauth: false
        });
      }
    },

    /**
     * Refresh tokens
     */
    async refreshTokens() {
      if (!browser) return false;
      
      try {
        const response = await fetch('/api/oauth/refresh', {
          method: 'POST',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Re-initialize to get updated user info
            await this.init();
            return true;
          } else if (data.requiresReauth) {
            update(state => ({ ...state, requiresReauth: true }));
            return false;
          }
        }
        
        return false;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
      }
    },

    /**
     * Clear reauth requirement (when user dismisses the notification)
     */
    clearReauthRequirement() {
      update(state => ({ ...state, requiresReauth: false }));
    },

    /**
     * Set loading state
     */
    setLoading(loading: boolean) {
      update(state => ({ ...state, loading }));
    },

    /**
     * Get current state (for internal use)
     */
    getCurrentState(): AuthState {
      let currentState: AuthState = initialState;
      subscribe(state => { currentState = state; })();
      return currentState;
    }
  };
}

export const auth = createAuthStore();