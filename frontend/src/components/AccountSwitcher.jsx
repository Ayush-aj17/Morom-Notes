import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function AccountSwitcher() {
    const { user, accounts, switchAccount, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    if (!user) return null;

    const currentAccount = accounts && accounts.length > 0 ? accounts.find(acc => acc.username === user) : null;

    return (
        <div className="relative">
            {/* Trigger Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-100 transition-colors"
                whileHover={{ scale: 1.05 }}
            >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                    {user?.[0]?.toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm font-medium text-stone-700">{user}</span>
                <svg
                    className={`w-4 h-4 text-stone-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-2 w-72 bg-white border border-stone-200 rounded-lg shadow-lg z-50"
                    >
                        {/* Current Account Section */}
                        <div className="p-3 border-b border-stone-100">
                            <p className="text-xs font-medium text-stone-500 uppercase mb-2">Current Account</p>
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                                        {user?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-stone-800">@{user}</p>
                                        <p className="text-xs text-stone-600">{currentAccount?.email || currentAccount?.phone || 'Not provided'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Other Accounts */}
                        {accounts && accounts.length > 1 && (
                            <div className="p-3 border-b border-stone-100">
                                <p className="text-xs font-medium text-stone-500 uppercase mb-2">Other Accounts</p>
                                <div className="space-y-2">
                                    {accounts
                                        .filter(acc => acc.username !== user)
                                        .map(account => (
                                            <button
                                                key={account.username}
                                                onClick={() => {
                                                    switchAccount(account.username);
                                                    setIsOpen(false);
                                                }}
                                                className="w-full p-3 rounded-lg hover:bg-stone-50 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-xs">
                                                        {account.username[0].toUpperCase()}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-stone-800 text-sm">@{account.username}</p>
                                                        <p className="text-xs text-stone-500">{account.email || account.phone}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="p-3 space-y-2">
                            <Link
                                to="/signup"
                                onClick={() => setIsOpen(false)}
                                className="w-full px-3 py-2 text-sm text-green-700 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>➕</span>
                                Add Account
                            </Link>
                            <Link
                                to="/accounts"
                                onClick={() => setIsOpen(false)}
                                className="w-full px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>⚙️</span>
                                Settings
                            </Link>
                            <button
                                onClick={() => {
                                    logout();
                                    setIsOpen(false);
                                }}
                                className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>🚪</span>
                                Logout
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Backdrop to close menu */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
