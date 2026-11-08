import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../api/api';

export default function UploadPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);
    const [videoLink, setVideoLink] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [error, setError] = useState('');
    const progressIntervalRef = useRef(null);

    useEffect(() => {
        setMounted(true);
        if (!token) {
            const timer = setTimeout(() => navigate('/login'), 100);
            return () => clearTimeout(timer);
        }
    }, [token, navigate]);

    useEffect(() => () => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }, []);

    const finish = (noteId, message) => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setIsProcessing(false);
        if (message) {
            setError(message);
            return;
        }
        setProgress(100);
        setProgressStatus('Completed!');
        setTimeout(() => navigate(`/editor/${noteId}`), 700);
    };

    const pollProgress = async (noteId) => {
        try {
            const response = await authFetch(`/api/notes/progress/${noteId}`);
            if (!response.ok) return;
            const data = await response.json();
            setProgress(data.progress || 0);
            setProgressStatus(data.status || 'Processing...');
            const status = String(data.status || '').toLowerCase();
            if (data.progress >= 100 || data.note_status === 'generated' || status.startsWith('completed')) {
                finish(noteId);
            } else if (data.note_status === 'failed' || status.startsWith('failed')) {
                finish(noteId, data.status || 'Note generation failed');
            }
        } catch (pollError) {
            console.error('Failed to fetch note progress:', pollError);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const url = videoLink.trim();
        if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
            setError('Please enter a valid YouTube link.');
            return;
        }

        setError('');
        setIsProcessing(true);
        setProgress(5);
        setProgressStatus('Starting...');

        try {
            const body = new URLSearchParams({ video_url: url });
            const response = await authFetch('/api/notes/generate', { method: 'POST', body });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.detail || `Generation failed (${response.status})`);
            if (!data.note_id) throw new Error('The server did not return a note ID.');

            await pollProgress(data.note_id);
            progressIntervalRef.current = setInterval(() => pollProgress(data.note_id), 1000);
        } catch (submitError) {
            setIsProcessing(false);
            setError(submitError.message || 'Unable to generate notes.');
        }
    };

    if (!mounted) return <div className="min-h-screen bg-cream" />;
    if (!token) return null;

    return (
        <div className="min-h-screen bg-cream flex items-center justify-center p-4 relative">
            <div className="absolute inset-0 pattern-dots text-stone-300 opacity-20 pointer-events-none" />
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xl bg-paper border border-stone-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 sm:p-10 relative z-10"
            >
                <button onClick={() => navigate('/')} className="text-sm text-stone-500 hover:text-stone-800 mb-8">
                    ← Back to dashboard
                </button>
                <h1 className="text-3xl sm:text-4xl font-display text-stone-800 mb-2">Create study notes</h1>
                <p className="text-stone-500 mb-8">Paste a YouTube lecture link and we’ll turn it into organized notes.</p>

                {error && <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

                {isProcessing ? (
                    <div className="p-5 rounded-xl bg-blue-50 border border-blue-200">
                        <div className="flex justify-between text-sm font-medium text-stone-700 mb-3">
                            <span>{progressStatus}</span><span>{progress}%</span>
                        </div>
                        <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                            <motion.div className="h-full bg-blue-600" animate={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-stone-500 mt-3">This may take a little while for longer videos.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label htmlFor="youtube-link" className="block text-sm font-medium text-stone-700">YouTube link</label>
                        <input
                            id="youtube-link"
                            type="url"
                            value={videoLink}
                            onChange={(event) => setVideoLink(event.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            required
                        />
                        <button type="submit" className="w-full py-3 rounded-lg bg-stone-800 text-white font-medium hover:bg-stone-900 transition-colors">
                            Generate notes
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
