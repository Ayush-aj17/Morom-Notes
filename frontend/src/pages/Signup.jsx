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

export default function Signup() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('credentials'); // 'credentials' or 'otp'
    const { signup, verifyOTP, switchAccount, loginWithToken } = useAuth();
    const [accounts, setAccounts] = useState(() => {
        const stored = localStorage.getItem('accounts');
        return stored ? JSON.parse(stored) : [];
    });

    const handleAccountClick = (account) => {
        switchAccount(account.username);
    };

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!email) {
            setError('Email is required');
            return;
        }

        if (!validateEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            console.log('Attempting signup with:', { username, email });
            const result = await signup(username, email, password);
            if (result.success && result.step === 'otp_sent') {
                setStep('otp');
                setPassword('');
                setConfirmPassword('');
            }
        } catch (err) {
            console.error('Signup error:', err);
            let errorMessage = err.message || 'Registration failed. Please try again.';
            
            // Handle specific server error responses
            if (err.message && err.message.includes('already exists with this email')) {
                errorMessage = 'Account with this email already exists. Please login instead.';
            } else if (err.message && err.message.includes('Username already taken')) {
                errorMessage = 'That username is already taken. Please choose another.';
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError(null);

        if (otp.length !== 6) {
            setError('Please enter a 6-digit code');
            return;
        }

        setLoading(true);
        try {
            const result = await verifyOTP(email, otp);
            if (result.success && result.data) {
                loginWithToken(result.data);
            }
        } catch (err) {
             console.error('OTP verification error:', err);
            setError(err.message || 'Invalid OTP. Please try again.');
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
            <div className="flex-1 flex items-center justify-center relative p-4">
                <div className="absolute inset-0 pattern-dots text-stone-300 opacity-30 pointer-events-none"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-md p-8 bg-paper border border-stone-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-display font-medium text-stone-800 tracking-tight">Create Account</h1>
                    <p className="text-stone-500 mt-2 text-sm">Join us and start taking smarter notes</p>
                </div>

                {/* Error Message */}
                {error && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6 text-sm"
                    >
                        <div className="flex items-start justify-between">
                            <span className="flex-1">{error}</span>
                            {(step === 'credentials' && error.includes('already exists')) && (
                                <Link 
                                    to="/login"
                                    className="ml-3 whitespace-nowrap font-medium text-blue-600 hover:text-blue-700 underline flex-shrink-0"
                                >
                                    Login →
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Credentials Step */}
                {step === 'credentials' && (
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Username */}
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="Choose a unique username"
                            required
                        />
                        <p className="text-xs text-stone-500 mt-1">At least 3 characters</p>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="your@email.com"
                            required
                        />
                        <p className="text-xs text-stone-500 mt-1">We'll send you a verification code</p>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="••••••••"
                            required
                        />
                        <p className="text-xs text-stone-500 mt-1">At least 6 characters</p>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>

                    {/* Terms */}
                    <p className="text-xs text-center text-stone-500">
                        By signing up, you agree to our Terms of Service and Privacy Policy
                    </p>
                </form>
                )}

                {/* OTP Verification Step */}
                {step === 'otp' && (
                <form onSubmit={handleVerifyOTP} className="space-y-5">
                    <p className="text-sm text-stone-600 text-center mb-4">
                        Enter the 6-digit code sent to <span className="font-medium">{email}</span>
                    </p>

                    {/* OTP Input */}
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">Verification Code</label>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setOtp(val);
                            }}
                            maxLength="6"
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-center text-2xl tracking-widest font-mono"
                            placeholder="000000"
                            required
                        />
                    </div>

                    {/* Verify Button */}
                    <button
                        type="submit"
                        disabled={loading || otp.length !== 6}
                        className="w-full bg-stone-800 hover:bg-stone-900 disabled:bg-stone-500 text-white font-medium py-3 rounded-xl transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:transform-none"
                    >
                        {loading ? 'Verifying...' : 'Verify and Create Account'}
                    </button>

                    {/* Back Button */}
                    <button
                        type="button"
                        onClick={() => {
                            setStep('credentials');
                            setOtp('');
                            setError(null);
                        }}
                        className="w-full text-sm text-stone-600 hover:text-stone-800 font-medium py-2"
                    >
                        ← Back to Registration
                    </button>
                </form>
                )}

                {/* Login Link */}
                <p className="mt-8 text-center text-sm text-stone-500">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </motion.div>
            </div>
        </div>
    );
}
