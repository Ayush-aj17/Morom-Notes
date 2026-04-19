import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import logoImage from '../assets/logo.jpeg';

export default function ForgotPassword() {
    const [step, setStep] = useState('email'); // email, otp, password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { forgotPassword, resetPassword, loginWithToken } = useAuth();

    const handleRequestOTP = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (!email) {
                setError('Email is required');
                setLoading(false);
                return;
            }

            await forgotPassword(email);
            setStep('otp');
        } catch (err) {
            setError(err.message || 'Failed to send reset code');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError(null);

        if (otp.length !== 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const result = await resetPassword(email, otp, newPassword);
            if (result.success && result.data) {
                loginWithToken(result.data);
            }
        } catch (err) {
            setError(err.message || 'Password reset failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden bg-cream font-sans">
            {/* Header Bar */}
            <div className="w-full bg-white border-b border-stone-200 py-4 px-6 flex justify-center items-center">
                <div className="text-4xl font-serif text-stone-800 tracking-wide flex items-center gap-3">
                    <img src={logoImage} alt="Morom Notes logo" className="h-12 w-12 object-contain opacity-40 rounded-[30%]" />
                    Morom Notes
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
                        <h1 className="text-3xl font-display font-medium text-stone-800 tracking-tight">
                            {step === 'email' ? 'Reset Password' : step === 'otp' ? 'Verify Code' : 'New Password'}
                        </h1>
                        <p className="text-stone-500 mt-2 text-sm">
                            {step === 'email' ? 'Enter your email to receive a reset code' : step === 'otp' ? 'We sent a code to your email' : 'Create your new password'}
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

                    {/* Step 1: Email */}
                    {step === 'email' && (
                        <motion.form 
                            onSubmit={handleRequestOTP}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4 }}
                            className="space-y-5"
                        >
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
                                <p className="text-xs text-stone-500 mt-1">We'll send you a verification code if this account exists</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-stone-800 hover:bg-stone-900 disabled:bg-stone-500 text-white font-medium py-3 rounded-xl transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:transform-none"
                            >
                                {loading ? 'Sending code...' : 'Send Reset Code'}
                            </button>

                            <div className="flex items-center justify-center pt-2">
                                <Link 
                                    to="/login" 
                                    className="text-sm text-stone-600 hover:text-stone-800 font-medium"
                                >
                                    ← Back to Login
                                </Link>
                            </div>
                        </motion.form>
                    )}

                    {/* Step 2: OTP Verification */}
                    {step === 'otp' && (
                        <motion.form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                setStep('password');
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4 }}
                            className="space-y-5"
                        >
                            <p className="text-sm text-stone-600 text-center bg-blue-50 border border-blue-100 rounded-lg p-3">
                                Enter the 6-digit code sent to <br />
                                <span className="font-medium">{email}</span>
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    Verification Code
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
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

                            <button
                                type="submit"
                                disabled={loading || otp.length !== 6}
                                className="w-full bg-stone-800 hover:bg-stone-900 disabled:bg-stone-500 text-white font-medium py-3 rounded-xl transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:transform-none"
                            >
                                Continue
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setStep('email');
                                    setOtp('');
                                    setError(null);
                                }}
                                className="w-full text-stone-600 hover:text-stone-800 font-medium py-2 transition-colors"
                            >
                                ← Back
                            </button>
                        </motion.form>
                    )}

                    {/* Step 3: New Password */}
                    {step === 'password' && (
                        <motion.form 
                            onSubmit={handleResetPassword}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4 }}
                            className="space-y-5"
                        >
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                                <p className="text-xs text-stone-500 mt-1">At least 6 characters</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-stone-800 hover:bg-stone-900 disabled:bg-stone-500 text-white font-medium py-3 rounded-xl transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:transform-none"
                            >
                                {loading ? 'Resetting password...' : 'Reset Password & Login'}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setStep('otp');
                                    setNewPassword('');
                                    setConfirmPassword('');
                                    setError(null);
                                }}
                                className="w-full text-stone-600 hover:text-stone-800 font-medium py-2 transition-colors"
                            >
                                ← Back
                            </button>
                        </motion.form>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
