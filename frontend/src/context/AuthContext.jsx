import { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../api/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Initialize token - with validation for JWT format changes
  const getInitialToken = () => {
    const storedToken = localStorage.getItem('currentToken');
    if (!storedToken) return null;
    
    // Validate token format (JWT should have 3 parts separated by dots)
    const parts = storedToken.split('.');
    if (parts.length !== 3) {
      console.warn('[AuthProvider] Invalid token format detected - clearing old token');
      localStorage.removeItem('currentToken');
      return null;
    }
    
    return storedToken;
  };

  const [token, setToken] = useState(getInitialToken());
  const [user, setUser] = useState(localStorage.getItem('currentUser') || null);
  const [userId, setUserId] = useState(localStorage.getItem('currentUserId') || null);
  const [accounts, setAccounts] = useState(() => {
    const stored = localStorage.getItem('accounts');
    return stored ? JSON.parse(stored) : [];
  });
  const [showEmailVerificationReminder, setShowEmailVerificationReminder] = useState(false);
  const navigate = useNavigate();

  // Helper function to clear all user-related localStorage data
  const clearAllUserData = () => {
    const userDataKeys = [
      'currentToken',
      'currentUser',
      'currentUserId',
      'currentUserEmail',
      'accounts',
      'token', // Legacy key
      'user', // Legacy key
    ];
    userDataKeys.forEach(key => {
      localStorage.removeItem(key);
    });
  };

  // Update localStorage whenever accounts change
  useEffect(() => {
    localStorage.setItem('accounts', JSON.stringify(accounts));
  }, [accounts]);

  const login = async (email, password) => {
    try {
      // Login returns token directly now (no OTP required)
      const response = await authFetch(`/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }
      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      throw err;
    }
  };

  const verifyOTP = async (email, otp) => {
    try {
      const response = await authFetch(`/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'OTP verification failed');
      }
      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      throw err;
    }
  };

  const loginWithToken = (tokenData) => {
    console.log('[loginWithToken] Called with data:', { 
      email: tokenData.email, 
      username: tokenData.username,
      hasAccessToken: !!tokenData.access_token
    });
    
    const { access_token, username, email, email_verified, user_id } = tokenData;
    
    // Check if account with same email already exists (email should be unique per database schema)
    const existingAccountByEmail = accounts.find(acc => acc.email === email);
    
    let updatedAccounts = accounts;
    
    if (existingAccountByEmail) {
      // Update existing account (same email, possibly different username due to username change)
      console.log(`[loginWithToken] Updating existing account: ${existingAccountByEmail.username} -> ${username}`);
      updatedAccounts = accounts.map(acc =>
        acc.email === email
          ? { ...acc, token: access_token, username, email_verified, user_id, loginTime: new Date().toISOString() }
          : acc
      );
      setAccounts(updatedAccounts);
    } else {
      // Add new account
      console.log(`[loginWithToken] Creating new account: ${username}`);
      updatedAccounts = [...accounts, {
        token: access_token,
        username,
        email,
        email_verified,
        user_id,
        loginTime: new Date().toISOString()
      }];
      setAccounts(updatedAccounts);
    }

    // Set as current account
    setToken(access_token);
    setUser(username);
    setUserId(user_id);
    localStorage.setItem('currentToken', access_token);
    localStorage.setItem('currentUser', username);
    localStorage.setItem('currentUserId', user_id);
    localStorage.setItem('currentUserEmail', email || '');
    
    console.log('[loginWithToken] ✓ Token stored in localStorage');
    console.log('[loginWithToken] Token substring:', access_token.substring(0, 30) + '...');

    navigate('/dashboard');
    return true;
  };

  const signup = async (username, email, password) => {
    try {
      // Clear all old localStorage data before signing up fresh
      clearAllUserData();
      
      const response = await authFetch(`/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Signup failed');
      }
      const data = await response.json();
      
      // Reset accounts state to empty before logging in new account
      setAccounts([]);
      
      // Return success with OTP sent message
      return { success: true, step: 'otp_sent', email, data };
    } catch (err) {
      throw err;
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await authFetch(`/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to send reset link (HTTP ${response.status})`);
      }
      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    } catch (err) {
      throw err;
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    try {
      const response = await authFetch(`/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPassword })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Password reset failed (HTTP ${response.status})`);
      }
      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    } catch (err) {
      throw err;
    }
  };

  const switchAccount = (username) => {
    const account = accounts.find(acc => acc.username === username);
    if (!account) {
      throw new Error('Account not found');
    }

    setToken(account.token);
    setUser(account.username);
    setUserId(account.user_id);
    localStorage.setItem('currentToken', account.token);
    localStorage.setItem('currentUser', account.username);
    localStorage.setItem('currentUserId', account.user_id);
    localStorage.setItem('currentUserEmail', account.email || '');

    if (!account.email_verified && account.email) {
      setShowEmailVerificationReminder(true);
    }

    navigate('/dashboard');
  };

  const removeAccount = (username) => {
    const updatedAccounts = accounts.filter(acc => acc.username !== username);
    setAccounts(updatedAccounts);

    // If removed account was current, switch to another account
    if (user === username) {
      if (updatedAccounts.length > 0) {
        switchAccount(updatedAccounts[0].username);
      } else {
        // No more accounts, logout from all
        setToken(null);
        setUser(null);
        setUserId(null);
        clearAllUserData();
        setShowEmailVerificationReminder(false);
        navigate('/');
      }
    }
  };

  const logout = (logoutAll = false) => {
    if (logoutAll) {
      setAccounts([]);
    } else {
      removeAccount(user);
      return;
    }

    setToken(null);
    setUser(null);
    setUserId(null);
    clearAllUserData();
    setShowEmailVerificationReminder(false);
    navigate('/login');
  };

  const updateUsername = (newUsername) => {
    // Update the current user's username in state
    setUser(newUsername);
    
    // Update the accounts array with new username
    const updatedAccounts = accounts.map(acc =>
      acc.username === user
        ? { ...acc, username: newUsername }
        : acc
    );
    setAccounts(updatedAccounts);
    
    // Update localStorage
    localStorage.setItem('currentUser', newUsername);
    
    console.log(`[updateUsername] Updated from ${user} to ${newUsername}`);
  };

  const cleanupDuplicateAccounts = () => {
    /**
     * Remove duplicate accounts with same email (keeps most recent)
     * Due to database schema, each email should only be in one user account
     */
    console.log('[cleanupDuplicateAccounts] Checking for duplicates...');
    
    const accountsByEmail = {};
    
    // Group accounts by email
    accounts.forEach(acc => {
      if (!accountsByEmail[acc.email]) {
        accountsByEmail[acc.email] = [];
      }
      accountsByEmail[acc.email].push(acc);
    });
    
    // Find emails with duplicates
    const duplicateEmails = Object.entries(accountsByEmail)
      .filter(([email, accs]) => accs.length > 1)
      .map(([email, accs]) => email);
    
    if (duplicateEmails.length === 0) {
      console.log('[cleanupDuplicateAccounts] No duplicates found');
      return false;
    }
    
    console.log(`[cleanupDuplicateAccounts] Found duplicates for emails: ${duplicateEmails.join(', ')}`);
    
    // Remove duplicates, keeping most recent login
    const cleanedAccounts = [];
    const emailsSeen = new Set();
    
    // Sort by loginTime (most recent first)
    const sortedAccounts = [...accounts].sort((a, b) => 
      new Date(b.loginTime) - new Date(a.loginTime)
    );
    
    sortedAccounts.forEach(acc => {
      if (!emailsSeen.has(acc.email)) {
        cleanedAccounts.push(acc);
        emailsSeen.add(acc.email);
      } else {
        console.log(`[cleanupDuplicateAccounts] Removing duplicate: ${acc.username} (${acc.email})`);
      }
    });
    
    // Restore original order and update state
    const finalAccounts = [...cleanedAccounts];
    setAccounts(finalAccounts);
    
    // Update localStorage if current account was removed
    const currentAccountExists = finalAccounts.find(acc => acc.username === user);
    if (!currentAccountExists && finalAccounts.length > 0) {
      const newCurrentAccount = finalAccounts[0];
      switchAccount(newCurrentAccount.username);
    }
    
    return true;
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      userId,
      accounts,
      showEmailVerificationReminder,
      setShowEmailVerificationReminder,
      login,
      verifyOTP,
      loginWithToken,
      signup,
      forgotPassword,
      resetPassword,
      switchAccount,
      removeAccount,
      logout,
      updateUsername,
      cleanupDuplicateAccounts
    }}>
      {children}
    </AuthContext.Provider>
  );
};
