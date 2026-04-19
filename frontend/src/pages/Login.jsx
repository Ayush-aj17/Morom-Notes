import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { motion as motionModule, AnimatePresence } from 'framer-motion';
import logoImage from '../assets/logo.jpeg';

function AccountsDropdown({ accounts, onAccountClick }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <motionModule.button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-100 transition-colors"
                whileHover={{ scale: 1.05 }}
            >
                <span className="text-sm font-medium text-stone-700 hidden sm:inline">My Accounts</span>
                <svg
                    className={`w-4 h-4 text-stone-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            </motionModule.button>

            <AnimatePresence>
                {isOpen && (
                    <motionModule.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-2 w-64 bg-white border border-stone-200 rounded-lg shadow-lg z-50"
                    >
                        {accounts && accounts.length > 0 ? (
                            <div className="p-3">
                                <p className="text-xs font-medium text-stone-500 uppercase mb-3">Logged In Accounts</p>
                                <div className="space-y-2">
                                    {accounts.map(account => (
                                        <button
                                            key={account.username}
                                            onClick={() => {
                                                onAccountClick(account);
                                                setIsOpen(false);
                                            }}
                                            className="w-full p-3 rounded-lg hover:bg-blue-50 transition-colors text-left border border-transparent hover:border-blue-200"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium text-xs">
                                                    {account.username[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm text-stone-800">@{account.username}</p>
                                                    <p className="text-xs text-stone-500">{account.email || account.phone}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-4">
                                <p className="text-sm text-stone-600 mb-3">No accounts logged in</p>
                                <p className="text-xs text-stone-500 mb-4">Create a new account or login to get started</p>
                                <Link
                                    to="/signup"
                                    onClick={() => setIsOpen(false)}
                                    className="block w-full px-3 py-2 text-sm text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium mb-2"
                                >
                                    Create Account
                                </Link>
                            </div>
                        )}
                    </motionModule.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login, loginWithToken, switchAccount } = useAuth();
    const [accounts, setAccounts] = useState(() => {
        const stored = localStorage.getItem('accounts');
        return stored ? JSON.parse(stored) : [];
    });

    const handleAccountClick = (account) => {
        switchAccount(account.username);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const result = await login(email, password);
            if (result.success && result.data && result.data.access_token) {
                loginWithToken(result.data);
            }
        } catch (err) {
            setError(err.message || 'Login failed. Please check your email and password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden bg-cream font-sans">
            {/* Header Bar */}
            <div className="w-full bg-white border-b border-stone-200 py-4 px-6 flex justify-center items-center relative">
                <div className="text-4xl font-serif text-stone-800 tracking-wide flex items-center gap-3">
                    <img src={logoImage} alt="Morom Notes logo" className="h-12 w-12 object-contain opacity-40 rounded-[30%]" />
                    Morom Notes
                </div>
                <div className="absolute right-6">
                    <AccountsDropdown accounts={accounts} onAccountClick={handleAccountClick} />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center relative">
                <div className="absolute inset-0 pattern-dots text-stone-300 opacity-30 pointer-events-none"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-md p-8 bg-paper border border-stone-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-display font-medium text-stone-800 tracking-tight">
                        Welcome back
                    </h1>
                    <p className="text-stone-500 mt-2 text-sm">
                        Sign in to your account
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6 text-sm"
                    >
                        {error}
                    </motion.div>
                )}

                {/* Login Form */}
                <motion.form 
                    onSubmit={handleLogin}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-5"
                >
                    {/* Email Input */}
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="your@email.com"
                            required
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-stone-700">
                                Password
                            </label>
                            <Link 
                                to="/forgot-password" 
                                className="text-xs text-blue-600 hover:underline font-medium"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-stone-800 hover:bg-stone-900 disabled:bg-stone-500 text-white font-medium py-3 rounded-xl transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:transform-none"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    {/* Divider */}
                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-stone-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-paper text-stone-500">or</span>
                        </div>
                    </div>

                    {/* Signup Link */}
                    <p className="text-center text-sm text-stone-500">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-blue-600 font-medium hover:underline">
                            Create one
                        </Link>
                    </p>
                </motion.form>
            </motion.div>
            </div>
        </div>
    );
}
