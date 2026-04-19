import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { authFetch } from '../api/api';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AccountManager() {
    const { user, accounts, switchAccount, removeAccount, logout, showEmailVerificationReminder, setShowEmailVerificationReminder, userId, updateUsername, cleanupDuplicateAccounts, token } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('accounts');
    const [otp, setOtp] = useState('');
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [showDeleteWarning, setShowDeleteWarning] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [editingUsername, setEditingUsername] = useState(user);
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changePasswordLoading, setChangePasswordLoading] = useState(false);
    const [changePasswordError, setChangePasswordError] = useState('');
    const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);
    const [changePasswordMode, setChangePasswordMode] = useState('current'); // 'current' or 'forgot'
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState(localStorage.getItem('currentUserEmail') || '');
    const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [userEmail, setUserEmail] = useState(localStorage.getItem('currentUserEmail') || '');

    // Calculate currentAccount
    const currentAccount = accounts.find(acc => acc.username === user);

    // Fetch user profile data if currentAccount email is not available
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const response = await authFetch('/auth/me');
                if (response.ok) {
                    const data = await response.json();
                    if (data.email) {
                        setUserEmail(data.email);
                        localStorage.setItem('currentUserEmail', data.email);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
            }
        };

        if (!currentAccount?.email && user) {
            fetchUserProfile();
        } else if (currentAccount?.email) {
            setUserEmail(currentAccount.email);
            localStorage.setItem('currentUserEmail', currentAccount.email);
        }
    }, [currentAccount, user]);

    // Ensure current account is in accounts array
    useEffect(() => {
        if (user && (!accounts || accounts.length === 0)) {
            // Reload accounts from a fresh fetch or reconstruct from current user
            const storedAccounts = localStorage.getItem('accounts');
            if (storedAccounts) {
                try {
                    const parsed = JSON.parse(storedAccounts);
                    if (parsed.length === 0 && user) {
                        // If accounts is empty but user exists, we need to sync
                        console.log('Accounts empty but user exists:', user);
                    }
                } catch (e) {
                    console.error('Failed to parse accounts:', e);
                }
            }
        }
    }, [user, accounts]);

    const handleDeleteAccount = async () => {
        if (!deleteConfirm) {
            setDeleteConfirm(true);
            setDeleteError('');
            return;
        }

        // Validate inputs
        if (!deletePassword) {
            setDeleteError('Password is required');
            return;
        }

        if (deleteConfirmText !== 'DELETE') {
            setDeleteError('You must type "DELETE" to confirm');
            return;
        }

        try {
            setDeleteLoading(true);
            setDeleteError('');

            const response = await authFetch('/auth/delete-account', {
                method: 'POST',
                body: JSON.stringify({
                    password: deletePassword,
                    confirmation: deleteConfirmText
                })
            });

            if (response.ok) {
                // Get remaining accounts before deletion
                const remainingAccounts = accounts.filter(acc => acc.username !== user);
                
                // Show success notification
                addToast(`Account @${user} has been permanently deleted`, 'success');
                
                // Remove account from local state
                removeAccount(user);
                
                // Reset form
                setDeleteConfirm(false);
                setDeletePassword('');
                setDeleteConfirmText('');
                setShowDeleteWarning(false);
            } else {
                const data = await response.json().catch(() => ({}));
                const errorMsg = data.detail || `Failed to delete account (${response.status})`;
                setDeleteError(errorMsg);
                console.error('Delete account error:', response.status, data);
            }
        } catch (err) {
            console.error('Failed to delete account:', err);
            setDeleteError(err.message || 'Network error. Please try again.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleCancelDelete = () => {
        setShowDeleteWarning(false);
        setDeleteConfirm(false);
        setDeletePassword('');
        setDeleteConfirmText('');
        setDeleteError('');
    };

    const handleUsernameChange = async () => {
        if (!editingUsername.trim()) {
            setUsernameError('Username cannot be empty');
            return;
        }

        if (editingUsername.length > 20) {
            setUsernameError('Username must be at most 20 characters');
            return;
        }

        if (editingUsername.trim().length < 3) {
            setUsernameError('Username must be at least 3 characters');
            return;
        }

        if (editingUsername === user) {
            setIsEditingUsername(false);
            return;
        }

        try {
            setUsernameLoading(true);
            setUsernameError('');

            console.log('[handleUsernameChange] ========== DEBUG ==========');
            console.log('[handleUsernameChange] Current user:', user);
            console.log('[handleUsernameChange] New username:', editingUsername.trim());
            console.log('[handleUsernameChange] Token from state:', token ? 'EXISTS' : 'MISSING');
            console.log('[handleUsernameChange] currentToken from localStorage:', localStorage.getItem('currentToken') ? 'EXISTS' : 'MISSING');
            console.log('[handleUsernameChange] token from localStorage:', localStorage.getItem('token') ? 'EXISTS' : 'MISSING');
            console.log('[handleUsernameChange] All localStorage keys:', Object.keys(localStorage));

            const response = await authFetch('/auth/change-username', {
                method: 'POST',
                body: JSON.stringify({
                    new_username: editingUsername.trim()
                })
            });

            console.log('[handleUsernameChange] Response status:', response.status);

            if (response.ok) {
                const newUsername = editingUsername.trim();
                
                // Update the context with new username
                updateUsername(newUsername);
                
                addToast(`Username changed to @${newUsername}`, 'success');
                setIsEditingUsername(false);
                
                console.log(`[handleUsernameChange] ✓ Username updated in context and localStorage`);
            } else {
                const data = await response.json().catch(() => ({}));
                console.log('[handleUsernameChange] Error response:', data);
                const errorMsg = data.detail || 'Failed to change username';
                setUsernameError(errorMsg);
            }
        } catch (err) {
            console.error('Failed to change username:', err);
            setUsernameError(err.message || 'Network error. Please try again.');
        } finally {
            setUsernameLoading(false);
        }
    };

    const handleCancelEditUsername = () => {
        setEditingUsername(user);
        setIsEditingUsername(false);
        setUsernameError('');
    };

    const handleRequestPasswordResetOTP = async () => {
        if (!forgotPasswordEmail) {
            setChangePasswordError('Email is required');
            return;
        }

        try {
            setChangePasswordLoading(true);
            setChangePasswordError('');

            // This would use the forgot-password endpoint from auth to send OTP
            const response = await authFetch('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({
                    email: forgotPasswordEmail
                })
            });

            if (response.ok) {
                setOtpSent(true);
                addToast('OTP sent to your email', 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                const errorMsg = data.detail || 'Failed to send OTP';
                setChangePasswordError(errorMsg);
            }
        } catch (err) {
            console.error('Failed to request OTP:', err);
            setChangePasswordError(err.message || 'Network error. Please try again.');
        } finally {
            setChangePasswordLoading(false);
        }
    };

    const handleChangePassword = async () => {
        setChangePasswordError('');
        setChangePasswordSuccess(false);

        if (changePasswordMode === 'current') {
            // Current password mode
            if (!currentPassword) {
                setChangePasswordError('Current password is required');
                return;
            }

            if (!newPassword) {
                setChangePasswordError('New password is required');
                return;
            }

            if (newPassword.length < 8) {
                setChangePasswordError('New password must be at least 8 characters');
                return;
            }

            if (newPassword !== confirmPassword) {
                setChangePasswordError('Passwords do not match');
                return;
            }

            if (newPassword === currentPassword) {
                setChangePasswordError('New password must be different from current password');
                return;
            }

            try {
                setChangePasswordLoading(true);

                const response = await authFetch('/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });

                if (response.ok) {
                    setChangePasswordSuccess(true);
                    addToast('Password changed successfully', 'success');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setTimeout(() => {
                        setShowChangePassword(false);
                        setChangePasswordSuccess(false);
                    }, 2000);
                } else {
                    const data = await response.json().catch(() => ({}));
                    const errorMsg = data.detail || 'Failed to change password';
                    setChangePasswordError(errorMsg);
                }
            } catch (err) {
                console.error('Failed to change password:', err);
                setChangePasswordError(err.message || 'Network error. Please try again.');
            } finally {
                setChangePasswordLoading(false);
            }
        } else if (changePasswordMode === 'forgot' && otpSent) {
            // Forgot password mode with OTP
            if (!forgotPasswordOtp) {
                setChangePasswordError('OTP is required');
                return;
            }

            if (!newPassword) {
                setChangePasswordError('New password is required');
                return;
            }

            if (newPassword.length < 8) {
                setChangePasswordError('New password must be at least 8 characters');
                return;
            }

            if (newPassword !== confirmPassword) {
                setChangePasswordError('Passwords do not match');
                return;
            }

            try {
                setChangePasswordLoading(true);

                const response = await authFetch('/auth/forgot-password/verify-otp', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: forgotPasswordEmail,
                        otp: forgotPasswordOtp,
                        new_password: newPassword
                    })
                });

                if (response.ok) {
                    setChangePasswordSuccess(true);
                    addToast('Password changed successfully', 'success');
                    setNewPassword('');
                    setConfirmPassword('');
                    setForgotPasswordOtp('');
                    setTimeout(() => {
                        setShowChangePassword(false);
                        setChangePasswordSuccess(false);
                        setChangePasswordMode('current');
                        setOtpSent(false);
                    }, 2000);
                } else {
                    const data = await response.json().catch(() => ({}));
                    const errorMsg = data.detail || 'Failed to change password';
                    setChangePasswordError(errorMsg);
                }
            } catch (err) {
                console.error('Failed to change password:', err);
                setChangePasswordError(err.message || 'Network error. Please try again.');
            } finally {
                setChangePasswordLoading(false);
            }
        }
    };

    const handleCancelChangePassword = () => {
        setShowChangePassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setChangePasswordError('');
        setChangePasswordSuccess(false);
        setChangePasswordMode('current');
        setOtpSent(false);
        setForgotPasswordOtp('');
    };

    return (
        <div className="min-h-screen bg-cream font-sans">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-white border-b border-stone-200 sticky top-0 z-40"
            >
                <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-display font-medium text-stone-800">Account Settings</h1>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-4 py-2 text-stone-600 hover:text-stone-800 font-medium"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </motion.div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Navigation Tabs */}
                <div className="mb-8 flex gap-2 border-b border-stone-200 overflow-x-auto">
                    {[
                        { id: 'accounts', label: '👥 Accounts', icon: '👥' },
                        { id: 'profile', label: '👤 Profile', icon: '👤' },
                        { id: 'security', label: '🔒 Security', icon: '🔒' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSection(tab.id)}
                            className={`px-4 py-3 font-medium whitespace-nowrap transition-all border-b-2 ${
                                activeSection === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-stone-600 hover:text-stone-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Accounts Section */}
                {activeSection === 'accounts' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-6"
                    >
                        <div>
                            <h2 className="text-xl font-medium text-stone-800 mb-4">My Accounts</h2>
                            <p className="text-stone-600 mb-6">
                                Switch between accounts easily. You can be logged into multiple accounts at once.
                            </p>
                        </div>

                        <div className="grid gap-4">
                            {accounts && accounts.length > 0 ? (
                                accounts.map(account => (
                                    <motion.div
                                        key={account.username}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`p-6 border rounded-lg transition-all ${
                                            account.username === user
                                                ? 'bg-blue-50 border-blue-300 shadow-sm'
                                                : 'bg-white border-stone-200 hover:border-stone-300'
                                        }`}
                                    >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                                                    {account.username[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-stone-800">@{account.username}</h3>
                                                    <p className="text-sm text-stone-600">{account.email || account.phone}</p>
                                                </div>
                                            </div>
                                            {account.email_verified && (
                                                <div className="mt-2 text-xs text-green-600 font-medium">
                                                    ✓ Email Verified
                                                </div>
                                            )}
                                            <div className="mt-2 text-xs text-stone-500">
                                                Logged in {account.loginTime ? new Date(account.loginTime).toLocaleDateString() : 'Recently'}
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            {account.username === user ? (
                                                <div className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-medium text-sm">
                                                    Current Account
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => switchAccount(account.username)}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all"
                                                >
                                                    Switch
                                                </button>
                                            )}
                                            <button
                                                onClick={() => removeAccount(account.username)}
                                                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium text-sm transition-all"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                                ))
                            ) : user ? (
                                <motion.div
                                    key={user}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-6 border rounded-lg transition-all bg-blue-50 border-blue-300 shadow-sm"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                                                    {user[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-stone-800">@{user}</h3>
                                                    <p className="text-sm text-stone-600">{currentAccount?.email || 'Not provided'}</p>
                                                </div>
                                            </div>
                                            {currentAccount?.email_verified && (
                                                <div className="mt-2 text-xs text-green-600 font-medium">
                                                    ✓ Email Verified
                                                </div>
                                            )}
                                            <div className="mt-2 text-xs text-stone-500">
                                                Logged in {currentAccount?.loginTime ? new Date(currentAccount.loginTime).toLocaleDateString() : 'Recently'}
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-medium text-sm">
                                                Current Account
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="p-4 bg-stone-100 text-stone-700 rounded-lg text-center">
                                    No accounts available. Please log in.
                                </div>
                            )}
                        </div>

                        {/* Logout All Button */}
                        <button
                            onClick={() => logout(true)}
                            className="w-full px-6 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg font-medium transition-all mt-8"
                        >
                            Logout from All Accounts
                        </button>
                    </motion.div>
                )}

                {/* Profile Section */}
                {activeSection === 'profile' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-6"
                    >
                        <div>
                            <h2 className="text-xl font-medium text-stone-800 mb-6">Profile Information</h2>
                        </div>

                        <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
                            {/* Profile Header */}
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-display text-2xl font-medium">
                                    {user[0].toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-medium text-stone-800">@{user}</h3>
                                    <p className="text-stone-600">Logged in since {currentAccount?.loginTime ? new Date(currentAccount.loginTime).toLocaleDateString() : 'Recently'}</p>
                                </div>
                            </div>

                            {/* Profile Details */}
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Username Edit Section */}
                                    <div className="col-span-2">
                                        <p className="text-sm text-stone-600 mb-3">Username</p>
                                        {isEditingUsername ? (
                                            <div className="space-y-3 p-4 bg-stone-50 rounded-lg">
                                                {usernameError && (
                                                    <div className="p-2 bg-red-100 border border-red-300 text-red-700 rounded text-sm">
                                                        {usernameError}
                                                    </div>
                                                )}
                                                <input
                                                    type="text"
                                                    value={editingUsername}
                                                    onChange={(e) => setEditingUsername(e.target.value.trimStart())}
                                                    placeholder="New username"
                                                    maxLength="30"
                                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-blue-500"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleUsernameChange}
                                                        disabled={usernameLoading}
                                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-400 text-white rounded-lg font-medium transition-all text-sm"
                                                    >
                                                        {usernameLoading ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEditUsername}
                                                        disabled={usernameLoading}
                                                        className="flex-1 px-4 py-2 bg-stone-200 hover:bg-stone-300 disabled:bg-stone-300 text-stone-800 rounded-lg font-medium transition-all text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                                                <p className="font-medium text-stone-800">@{user}</p>
                                                <button
                                                    onClick={() => setIsEditingUsername(true)}
                                                    className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg font-medium transition-all"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 bg-stone-50 rounded-lg col-span-2">
                                        <p className="text-sm text-stone-600 mb-1">Email</p>
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-stone-800">{userEmail || currentAccount?.email || '-'}</p>
                                            {currentAccount?.email_verified && (
                                                <span className="text-xs text-green-600 font-medium">✓ Verified</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}


                {/* Security Section */}
                {activeSection === 'security' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-6"
                    >
                        <div>
                            <h2 className="text-xl font-medium text-stone-800 mb-6">Security Settings</h2>
                        </div>

                        {/* Change Password */}
                        <div className="bg-white border border-stone-200 rounded-lg p-6">
                            <h3 className="font-medium text-stone-800 mb-4">Change Password</h3>
                            <p className="text-stone-600 text-sm mb-4">
                                Keep your account secure by changing your password regularly.
                            </p>
                            <button 
                                onClick={() => setShowChangePassword(true)}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all">
                                Change Password
                            </button>
                        </div>

                        {/* Change Password Modal */}
                        {showChangePassword && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                                onClick={handleCancelChangePassword}
                            >
                                <motion.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.95, opacity: 0 }}
                                    transition={{ type: 'spring', damping: 20 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden"
                                >
                                    {/* Header with Mode Toggle */}
                                    <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
                                        <h2 className="text-lg font-bold text-blue-800">Change Password</h2>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => {
                                                    setChangePasswordMode('current');
                                                    setOtpSent(false);
                                                    setChangePasswordError('');
                                                    setCurrentPassword('');
                                                }}
                                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                    changePasswordMode === 'current'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                }`}
                                            >
                                                Current Password
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setChangePasswordMode('forgot');
                                                    setOtpSent(false);
                                                    setChangePasswordError('');
                                                }}
                                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                    changePasswordMode === 'forgot'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                }`}
                                            >
                                                Forgot Password
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="px-6 py-4 space-y-4">
                                        {changePasswordError && (
                                            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                                                {changePasswordError}
                                            </div>
                                        )}

                                        {changePasswordSuccess && (
                                            <div className="p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg text-sm">
                                                ✓ Password changed successfully!
                                            </div>
                                        )}

                                        {changePasswordMode === 'current' ? (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium text-stone-700 mb-2">
                                                        Current Password
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={currentPassword}
                                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                                        placeholder="Enter your current password"
                                                        disabled={changePasswordLoading}
                                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-stone-50"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-stone-700 mb-2">
                                                        New Password
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        placeholder="Enter your new password"
                                                        disabled={changePasswordLoading}
                                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-stone-50"
                                                    />
                                                    <p className="text-xs text-stone-500 mt-1">Must be at least 8 characters</p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-stone-700 mb-2">
                                                        Confirm New Password
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        placeholder="Confirm your new password"
                                                        disabled={changePasswordLoading}
                                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-stone-50"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium text-stone-700 mb-2">
                                                        Email Address
                                                    </label>
                                                    <input
                                                        type="email"
                                                        value={forgotPasswordEmail}
                                                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                                        placeholder="Enter your email"
                                                        disabled={changePasswordLoading || otpSent}
                                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-stone-50"
                                                    />
                                                </div>

                                                {!otpSent ? (
                                                    <button
                                                        onClick={handleRequestPasswordResetOTP}
                                                        disabled={changePasswordLoading || !forgotPasswordEmail}
                                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-400 text-white rounded-lg font-medium transition-all"
                                                    >
                                                        {changePasswordLoading ? 'Sending OTP...' : 'Send OTP to Email'}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <div>
                                                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                                                OTP Code
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={forgotPasswordOtp}
                                                                onChange={(e) => setForgotPasswordOtp(e.target.value.slice(0, 6))}
                                                                placeholder="Enter 6-digit OTP"
                                                                disabled={changePasswordLoading}
                                                                maxLength="6"
                                                                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-stone-50 text-center tracking-widest"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                                                New Password
                                                            </label>
                                                            <input
                                                                type="password"
                                                                value={newPassword}
                                                                onChange={(e) => setNewPassword(e.target.value)}
                                                                placeholder="Enter your new password"
                                                                disabled={changePasswordLoading}
                                                                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-stone-50"
                                                            />
                                                            <p className="text-xs text-stone-500 mt-1">Must be at least 8 characters</p>
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                                                Confirm New Password
                                                            </label>
                                                            <input
                                                                type="password"
                                                                value={confirmPassword}
                                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                                placeholder="Confirm your new password"
                                                                disabled={changePasswordLoading}
                                                                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-stone-50"
                                                            />
                                                        </div>

                                                        <button
                                                            onClick={() => setOtpSent(false)}
                                                            disabled={changePasswordLoading}
                                                            className="w-full px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                                        >
                                                            Didn't receive OTP? Send again
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex gap-3">
                                        <button
                                            onClick={handleCancelChangePassword}
                                            disabled={changePasswordLoading}
                                            className="flex-1 px-4 py-2 bg-stone-200 hover:bg-stone-300 disabled:bg-stone-300 text-stone-800 rounded-lg font-medium transition-all"
                                        >
                                            Cancel
                                        </button>
                                        {changePasswordMode === 'current' && (
                                            <button
                                                onClick={handleChangePassword}
                                                disabled={changePasswordLoading || !currentPassword || !newPassword || !confirmPassword}
                                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-400 text-white rounded-lg font-medium transition-all"
                                            >
                                                {changePasswordLoading ? 'Changing...' : 'Change Password'}
                                            </button>
                                        )}
                                        {changePasswordMode === 'forgot' && otpSent && (
                                            <button
                                                onClick={handleChangePassword}
                                                disabled={changePasswordLoading || !forgotPasswordOtp || !newPassword || !confirmPassword}
                                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-400 text-white rounded-lg font-medium transition-all"
                                            >
                                                {changePasswordLoading ? 'Changing...' : 'Change Password'}
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}

                        {/* Delete Account */}
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                            <h3 className="font-medium text-red-800 mb-2">Delete Account</h3>
                            <p className="text-red-700 text-sm mb-4">
                                ⚠️ Deleting your account will permanently erase all your notes, folders, and data. This action cannot be undone.
                            </p>

                            <button
                                onClick={() => setShowDeleteWarning(true)}
                                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
                            >
                                Delete Account
                            </button>
                        </div>

                        {/* Delete Warning Modal */}
                        {showDeleteWarning && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                                onClick={handleCancelDelete}
                            >
                                <motion.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.95, opacity: 0 }}
                                    transition={{ type: 'spring', damping: 20 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className="bg-red-50 border-b border-red-200 px-6 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl mt-1">⚠️</div>
                                            <div>
                                                <h2 className="text-lg font-bold text-red-800">Delete Account?</h2>
                                                <p className="text-sm text-red-700 mt-1">This action cannot be undone</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="px-6 py-4 space-y-4">
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                            <p className="text-sm font-medium text-red-900 mb-2">You will lose:</p>
                                            <ul className="text-sm text-red-800 space-y-2">
                                                <li className="flex gap-2">
                                                    <span>📝</span>
                                                    <span>All your notes and folders</span>
                                                </li>
                                                <li className="flex gap-2">
                                                    <span>📂</span>
                                                    <span>All documents and uploads</span>
                                                </li>
                                                <li className="flex gap-2">
                                                    <span>⭐</span>
                                                    <span>All favorites and preferences</span>
                                                </li>
                                                <li className="flex gap-2">
                                                    <span>🔐</span>
                                                    <span>Account access entirely</span>
                                                </li>
                                            </ul>
                                        </div>

                                        <p className="text-sm text-stone-700">
                                            Are you absolutely sure you want to permanently delete your account <strong>@{user}</strong>?
                                        </p>
                                    </div>

                                    {/* Footer */}
                                    <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex gap-3">
                                        <button
                                            onClick={handleCancelDelete}
                                            className="flex-1 px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg font-medium transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowDeleteWarning(false);
                                                setDeleteConfirm(true);
                                            }}
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
                                        >
                                            Continue
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}

                        {/* Delete Confirmation Form */}
                        {deleteConfirm && !showDeleteWarning && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                                <div className="space-y-4 p-4 bg-white rounded-lg border border-red-300">
                                    <p className="font-medium text-stone-800">Verify your identity</p>
                                    <p className="text-sm text-stone-600">
                                        Enter your password and type "DELETE" to confirm.
                                    </p>

                                    {deleteError && (
                                        <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                                            {deleteError}
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                                Enter your password
                                            </label>
                                            <input
                                                type="password"
                                                value={deletePassword}
                                                onChange={(e) => setDeletePassword(e.target.value)}
                                                placeholder="Password"
                                                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-red-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                                Type "DELETE" to confirm
                                            </label>
                                            <input
                                                type="text"
                                                value={deleteConfirmText}
                                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                                placeholder="DELETE"
                                                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-red-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleCancelDelete}
                                            disabled={deleteLoading}
                                            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 disabled:bg-stone-300 text-stone-800 rounded-lg font-medium transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDeleteAccount}
                                            disabled={deleteLoading || !deletePassword || deleteConfirmText !== 'DELETE'}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-stone-400 text-white rounded-lg font-medium transition-all"
                                        >
                                            {deleteLoading ? 'Deleting...' : 'Yes, Delete Permanently'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
