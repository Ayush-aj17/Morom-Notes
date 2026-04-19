import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../api/api';

export default function UploadPage() {
    const MOTION = motion;
    // All hooks must be at the top level, before any conditional returns
    const { token } = useAuth();
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState('video-link'); // 'video-link', 'video-file', 'document'
    const [videoLink, setVideoLink] = useState('');
    const [files, setFiles] = useState([]); // For multi-file upload
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [pipeline, setPipeline] = useState('audio-video'); // 'audio-only' or 'audio-video'
    
    // Progress tracking
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const progressIntervalRef = useRef(null);
    const pseudoProgressIntervalRef = useRef(null);
    const lastStatusReconcileAtRef = useRef(0);
    const [isPolling, setIsPolling] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!token) {
            // Redirect to login if not authenticated
            const timer = setTimeout(() => navigate('/login'), 100);
            return () => clearTimeout(timer);
        }
    }, [token, navigate]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (pseudoProgressIntervalRef.current) clearInterval(pseudoProgressIntervalRef.current);
        };
    }, []);

    // Animate pseudo-progress only during initial upload (before polling starts)
    useEffect(() => {
        if (isProcessing && !isPolling && progress < 95) {
            const interval = setInterval(() => {
                setProgress(prev => {
                    // Gradually increase progress, slowing down as it approaches 95%
                    if (prev >= 90) return Math.min(prev + 0.5, 95);
                    if (prev >= 50) return Math.min(prev + 2, 95);
                    if (prev >= 20) return Math.min(prev + 3, 95);
                    return Math.min(prev + 5, 95);
                });
            }, 400);
            pseudoProgressIntervalRef.current = interval;
            return () => clearInterval(interval);
        }
    }, [isProcessing, isPolling, progress]);

    const DOCUMENT_TYPES = {
        pdf: { ext: '.pdf', icon: 'ðŸ“„', label: 'PDF Document' },
        ppt: { ext: '.pptx', icon: 'ðŸ“Š', label: 'PowerPoint' },
        image: { ext: '.png, .jpg', icon: 'ðŸ–¼ï¸', label: 'Image' }
    };

    const stopAllProgressTimers = () => {
        setIsPolling(false);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (pseudoProgressIntervalRef.current) clearInterval(pseudoProgressIntervalRef.current);
        progressIntervalRef.current = null;
        pseudoProgressIntervalRef.current = null;
    };

    const finishAsSuccess = (noteId) => {
        stopAllProgressTimers();
        setIsProcessing(false);
        setProgress(100);
        setProgressStatus('Completed!');
        setSuccess('Note generated successfully!');
        setTimeout(() => navigate(`/editor/${noteId}`), 1500);
    };

    const finishAsFailure = (message) => {
        stopAllProgressTimers();
        setIsProcessing(false);
        setError(message || 'Note generation failed');
    };

    // Fetch progress updates for a note
    const fetchProgress = async (noteId) => {
        try {
            const res = await authFetch(`/api/notes/progress/${noteId}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`Progress for note ${noteId}:`, data);
                setProgress(prev => (data.progress === 0 || data.progress === 100) ? data.progress : Math.max(prev, data.progress));
                setProgressStatus(data.status);
                const statusText = String(data.status || '').toLowerCase();
                const isFailed = data.note_status === 'failed' || statusText.startsWith('failed');
                const isCompleted = data.progress >= 100 || data.note_status === 'generated' || statusText.startsWith('completed');
                
                // Stop polling when complete
                if (isCompleted) {
                    console.log('Note generation complete, redirecting...');
                    finishAsSuccess(noteId);
                }
                // Stop on failure
                else if (isFailed) {
                    console.log('Note generation failed');
                    finishAsFailure('Note generation failed: ' + data.status);
                }
                // Reconcile near-complete states using canonical note status endpoint.
                else if (data.progress >= 95) {
                    const now = Date.now();
                    if (now - lastStatusReconcileAtRef.current > 2000) {
                        lastStatusReconcileAtRef.current = now;
                        try {
                            const noteRes = await authFetch(`/api/notes/${noteId}`);
                            if (noteRes.ok) {
                                const noteData = await noteRes.json();
                                const noteState = String(noteData.status || '').toLowerCase();
                                if (noteState === 'generated') {
                                    console.log('Note details confirm generated state, finalizing...');
                                    finishAsSuccess(noteId);
                                } else if (noteState === 'failed') {
                                    finishAsFailure('Note generation failed: ' + (noteData.progress_status || 'Failed'));
                                }
                            }
                        } catch (reconcileErr) {
                            console.warn('Progress reconciliation failed:', reconcileErr);
                        }
                    }
                }
            } else {
                // Handle non-OK responses
                const errorText = await res.text();
                console.error(`Progress API error (${res.status}):`, errorText);
                
                if (res.status === 401) {
                    console.error('Unauthorized - token may have expired');
                    finishAsFailure('Session expired - please refresh the page');
                } else if (res.status === 404) {
                    console.error('Note not found');
                    // Note might still be processing, don't stop polling yet
                } else {
                    console.error(`Server error: ${res.status}`);
                }
            }
        } catch (err) {
            console.error('Failed to fetch progress:', err);
            // Don't stop polling on network errors, server might be temporarily unavailable
        }
    };

    // Start polling for progress
    const startProgressPolling = (noteId) => {
        console.log(`Starting progress polling for note ${noteId}`);
        stopAllProgressTimers();
        setIsPolling(true);
        lastStatusReconcileAtRef.current = 0;
        setProgress(0);
        setProgressStatus('Starting...');
        
        // Fetch immediately, then every 500ms
        fetchProgress(noteId);
        const interval = setInterval(() => fetchProgress(noteId), 500);
        progressIntervalRef.current = interval;
    };

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            setFiles([...files, ...selectedFiles]);
            setError(null);
            // Reset input so user can add the same file again
            e.target.value = '';
        }
    };

    const handleRemoveFile = (indexToRemove) => {
        setFiles(files.filter((_, index) => index !== indexToRemove));
    };

    const handleCreateNote = async () => {
        if (files.length === 0) {
            setError('Please select at least one file');
            return;
        }

        setIsProcessing(true);
        setError(null);

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        try {
            console.log(`Uploading ${files.length} document(s):`, files.map(f => f.name).join(', '));
            const res = await authFetch('/api/documents/process-multi', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || `Server error: ${res.status}`);
            }

            const data = await res.json();
            console.log('Documents uploaded, note created:', data.note_id);
            
            if (!data.note_id) {
                throw new Error('No note_id in response');
            }
            
            // Start polling for progress
            startProgressPolling(data.note_id);
        } catch (err) {
            console.error('Document upload error:', err);
            setError(err.message || 'Failed to create note from document');
            setIsProcessing(false);
        }
    };

    const handleVideoSubmit = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        setError(null);

        let bodyData;
        const maxSize = 500 * 1024 * 1024;

        if (activeTab === 'video-link') {
            bodyData = new URLSearchParams();
            bodyData.append('video_url', videoLink);
            bodyData.append('pipeline', pipeline);
        } else {
            // For video-file tab, check files array
            if (files.length === 0) {
                setError('Please select a file');
                setIsProcessing(false);
                return;
            }

            // Use the first file from the files array
            const selectedFile = files[0];
            if (selectedFile.size > maxSize) {
                setError('File too large (max 500MB)');
                setIsProcessing(false);
                return;
            }

            bodyData = new FormData();
            bodyData.append('file', selectedFile);
            bodyData.append('pipeline', pipeline);
        }

        try {
            const sourceType = activeTab === 'video-link' ? 'YouTube link' : 'video file';
            console.log(`Starting note generation from ${sourceType} with pipeline: ${pipeline}`);
            
            const res = await authFetch(`/api/notes/generate`, {
                method: 'POST',
                body: bodyData
            });
            
            if (!res.ok) {
                let errorMessage = `Failed to start generation (${res.status})`;
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.detail || errorMessage;
                } catch {
                    // If JSON parsing fails, try text
                    try {
                        const errorText = await res.text();
                        if (errorText) {
                            errorMessage = errorText;
                        }
                    } catch {
                        // Use default error message
                    }
                }
                throw new Error(errorMessage);
            }
            
            const data = await res.json();
            console.log('Note generation started:', data.note_id);
            
            if (!data.note_id) {
                throw new Error('No note_id in response');
            }
            
            // Start polling for progress
            startProgressPolling(data.note_id);
        } catch (err) {
            console.error('Video generation error:', err);
            setError(err.message || 'Failed to fetch - check your connection and try again');
            setIsProcessing(false);
        }
    };

    return (
        // Show loading while checking auth
        !mounted ? (
            <div className="min-h-screen bg-cream flex items-center justify-center">
                <div className="text-center">
                    <p className="text-stone-600">Loading...</p>
                </div>
            </div>
        ) : // If no token, show error
        !token ? (
            <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
                <MOTION.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md bg-red-50 border border-red-200 rounded-xl p-8 text-center"
                >
                    <h2 className="text-lg font-semibold text-red-600 mb-3">Not Authenticated</h2>
                    <p className="text-red-600 text-sm mb-6">You must log in to access this page.</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Go to Login
                    </button>
                </MOTION.div>
            </div>
        ) : (
            // Main UI when authenticated
            <div className="min-h-screen bg-cream flex flex-col items-center justify-center relative p-3 sm:p-6">
                <div className="absolute inset-0 pattern-dots text-stone-300 opacity-20 pointer-events-none"></div>

            <div className="w-full max-w-2xl text-center mb-6 sm:mb-8 relative z-10 px-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-medium text-stone-800 mb-2">Create New Notes</h1>
                <p className="text-xs sm:text-sm text-stone-500">Upload youtube link, videos, documents, or images to automatically generate organized notes</p>
            </div>

            <MOTION.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-paper p-4 sm:p-6 md:p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-stone-100 relative z-10 mx-2"
            >
                {/* Progress Display */}
                {isProcessing && (
                    <MOTION.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl"
                    >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3">
                            <h3 className="font-semibold text-stone-800 text-sm sm:text-base">Processing</h3>
                            <span className="text-base sm:text-lg font-bold text-blue-600">{progress}%</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-blue-200 rounded-full h-2 sm:h-3 mb-3 sm:mb-4 overflow-hidden">
                            <MOTION.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                            />
                        </div>
                        
                        {/* Status Message */}
                        {progressStatus && (
                            <MOTION.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs sm:text-sm text-blue-700 flex items-center gap-2"
                            >
                                <span className="inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                                {progressStatus}
                            </MOTION.p>
                        )}
                    </MOTION.div>
                )}

                {/* Tab Navigation */}
                <div className="flex flex-wrap gap-1 sm:gap-2 mb-6 sm:mb-8 bg-stone-100 p-1 sm:p-2 rounded-xl">
                    <button
                        onClick={() => { setActiveTab('video-link'); setError(null); setFiles([]); setVideoLink(''); }}
                        className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                            activeTab === 'video-link' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'
                        }`}
                    >
                        🔗 Youtube Link
                    </button>
                    <button
                        onClick={() => { setActiveTab('video-file'); setError(null); setFiles([]); setVideoLink(''); }}
                        className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                            activeTab === 'video-file' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'
                        }`}
                    >
                        🎧 Video / Audio
                    </button>
                    <button
                        onClick={() => { setActiveTab('document'); setError(null); setFiles([]); setVideoLink(''); }}
                        className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                            activeTab === 'document' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'
                        }`}
                    >
                        📄 Documents
                    </button>
                </div>

                {/* Error Messages */}
                {error && (
                    <MOTION.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-6 text-sm"
                    >
                        {error}
                    </MOTION.div>
                )}

                {/* Success Messages */}
                {success && (
                    <MOTION.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-green-50 border border-green-200 text-green-600 p-4 rounded-xl mb-6 text-sm"
                    >
                        {success}
                    </MOTION.div>
                )}

                {/* Video Link Tab */}
                {activeTab === 'video-link' && (
                    <>
                        {!isProcessing ? (
                            <form onSubmit={handleVideoSubmit} className="space-y-4 sm:space-y-6">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-2">YouTube URL</label>
                                    <input
                                        type="url"
                                        required
                                        value={videoLink}
                                        onChange={e => setVideoLink(e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                    />
                                </div>

                                {/* Pipeline Selection */}
                                <div className="p-4 sm:p-5 bg-blue-50 border border-blue-200 rounded-xl">
                                    <label className="block text-xs sm:text-sm font-semibold text-stone-800 mb-3">
                                        ⚡ Processing Pipeline
                                    </label>
                                    <p className="text-xs text-stone-600 mb-3">Choose how you want your notes generated:</p>
                                    
                                    <div className="space-y-2">
                                        <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-transparent hover:border-blue-300 cursor-pointer transition-colors" style={{borderColor: pipeline === 'audio-only' ? '#3b82f6' : 'transparent'}}>
                                            <input
                                                type="radio"
                                                name="pipeline"
                                                value="audio-only"
                                                checked={pipeline === 'audio-only'}
                                                onChange={(e) => setPipeline(e.target.value)}
                                                className="mt-1 w-4 h-4 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <p className="text-xs sm:text-sm font-medium text-stone-800">🚀 Audio Only (Fast)</p>
                                                <p className="text-xs text-stone-600">Uses only the audio transcript for notes. Quickest processing.</p>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-transparent hover:border-blue-300 cursor-pointer transition-colors" style={{borderColor: pipeline === 'audio-video' ? '#3b82f6' : 'transparent'}}>
                                            <input
                                                type="radio"
                                                name="pipeline"
                                                value="audio-video"
                                                checked={pipeline === 'audio-video'}
                                                onChange={(e) => setPipeline(e.target.value)}
                                                className="mt-1 w-4 h-4 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <p className="text-xs sm:text-sm font-medium text-stone-800">🎯 Audio + Video (Accurate)</p>
                                                <p className="text-xs text-stone-600">Uses audio transcript AND extracts text from on-screen content (OCR). More accurate but slower.</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className={`w-full py-3 sm:py-4 text-sm sm:text-base text-white font-medium rounded-xl transition-all shadow-sm ${
                                        isProcessing ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-800 hover:bg-stone-900 hover:shadow-md hover:-translate-y-0.5'
                                    }`}
                                >
                                    ✨ Create Note
                                </button>
                            </form>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-stone-600 text-sm mb-6">Your notes are being generated from the video. Please wait...</p>
                            </div>
                        )}
                    </>
                )}

                {/* Video File Tab */}
                {activeTab === 'video-file' && (
                    <>
                        {!isProcessing ? (
                            <form onSubmit={handleVideoSubmit} className="space-y-4 sm:space-y-6">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-2">Video or Audio File (Max 500MB)</label>
                                    <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 sm:p-8 text-center hover:bg-stone-50 transition-colors">
                                        <input
                                            type="file"
                                            accept="video/*,audio/*"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    setFiles([e.target.files[0]]);
                                                    setError(null);
                                                    e.target.value = '';
                                                }
                                            }}
                                            className="w-full text-xs sm:text-sm text-stone-500 file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-medium file:bg-blue-100 file:text-blue-600 hover:file:bg-blue-200 cursor-pointer"
                                        />
                                        {files.length > 0 && <p className="text-xs sm:text-sm text-stone-500 mt-3">Selected: {files[0].name}</p>}
                                    </div>
                                </div>

                                {/* Pipeline Selection */}
                                <div className="p-4 sm:p-5 bg-blue-50 border border-blue-200 rounded-xl">
                                    <label className="block text-xs sm:text-sm font-semibold text-stone-800 mb-3">
                                        ⚡ Processing Pipeline
                                    </label>
                                    <p className="text-xs text-stone-600 mb-3">Choose how you want your notes generated:</p>
                                    
                                    <div className="space-y-2">
                                        <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-transparent hover:border-blue-300 cursor-pointer transition-colors" style={{borderColor: pipeline === 'audio-only' ? '#3b82f6' : 'transparent'}}>
                                            <input
                                                type="radio"
                                                name="pipeline"
                                                value="audio-only"
                                                checked={pipeline === 'audio-only'}
                                                onChange={(e) => setPipeline(e.target.value)}
                                                className="mt-1 w-4 h-4 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <p className="text-xs sm:text-sm font-medium text-stone-800">🚀 Audio Only (Fast)</p>
                                                <p className="text-xs text-stone-600">Uses only the audio transcript for notes. Quickest processing.</p>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-transparent hover:border-blue-300 cursor-pointer transition-colors" style={{borderColor: pipeline === 'audio-video' ? '#3b82f6' : 'transparent'}}>
                                            <input
                                                type="radio"
                                                name="pipeline"
                                                value="audio-video"
                                                checked={pipeline === 'audio-video'}
                                                onChange={(e) => setPipeline(e.target.value)}
                                                className="mt-1 w-4 h-4 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <p className="text-xs sm:text-sm font-medium text-stone-800">🎯 Audio + Video (Accurate)</p>
                                                <p className="text-xs text-stone-600">Uses audio transcript AND extracts text from on-screen content (OCR). More accurate but slower.</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isProcessing || files.length === 0}
                                    className={`w-full py-3 sm:py-4 text-sm sm:text-base text-white font-medium rounded-xl transition-all shadow-sm ${
                                        isProcessing || files.length === 0 ? 'bg-stone-400 cursor-not-allowed' : 'bg-stone-800 hover:bg-stone-900 hover:shadow-md hover:-translate-y-0.5'
                                    }`}
                                >
                                    ✨ Create Note
                                </button>
                            </form>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-stone-600 text-sm mb-6">Your notes are being generated from the video. Please wait...</p>
                            </div>
                        )}
                    </>
                )}

                {/* Document Tab */}
                {activeTab === 'document' && (
                    <div className="space-y-6">
                        {!isProcessing ? (
                            <>
                                {/* Document Upload Info */}
                                <div className="p-3 sm:p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                    <p className="text-xs sm:text-sm text-blue-800 mb-2 sm:mb-3 font-medium">
                                        📄 Supported Formats:
                                    </p>

                                    <div className="space-y-1 sm:space-y-2">
                                        <p className="text-xs text-blue-700">✅ PDFs - Extract text with OCR from images</p>
                                        <p className="text-xs text-blue-700">✅ PowerPoint - Extract slides, text, and scan images</p>
                                        <p className="text-xs text-blue-700">✅ Images - OCR to extract text from photos</p>
                                        <p className="text-xs text-blue-700 font-medium mt-1 sm:mt-2">
                                            💡 Add multiple files to combine into 1 note!
                                        </p>
                                    </div>
                                </div>

                                {/* Document Upload */}
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-2">Document Files (Multiple Supported)</label>
                                    <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 sm:p-8 text-center hover:bg-stone-50 transition-colors">
                                        <input
                                            type="file"
                                            multiple
                                            accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.bmp,.gif"
                                            onChange={handleFileSelect}
                                            className="w-full text-xs sm:text-sm text-stone-500 file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-medium file:bg-green-100 file:text-green-600 hover:file:bg-green-200 cursor-pointer"
                                        />
                                    </div>

                                    {/* Selected Files List */}
                                    {files.length > 0 && (
                                        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-xl">
                                            <p className="text-xs sm:text-sm font-medium text-green-900 mb-2 sm:mb-3">
                                                {files.length} file(s) selected:
                                            </p>
                                            <ul className="space-y-1 sm:space-y-2">
                                                {files.map((f, idx) => (
                                                    <li key={idx} className="flex items-center justify-between gap-2 sm:gap-3 p-2 bg-white rounded-lg border border-green-100">
                                                        <span className="text-xs sm:text-sm text-stone-700 flex-1 truncate">
                                                            ✅ {f.name}
                                                        </span>
                                                        <button
                                                            onClick={() => handleRemoveFile(idx)}
                                                            className="text-xs px-2 sm:px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap"
                                                        >
                                                            Remove
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div>
                                    <button
                                        onClick={handleCreateNote}
                                        disabled={isProcessing || files.length === 0}
                                        className={`w-full py-3 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-white font-medium rounded-xl transition-all shadow-sm ${
                                            isProcessing || files.length === 0
                                                ? 'bg-stone-400 cursor-not-allowed'
                                                : 'bg-stone-800 hover:bg-stone-900 hover:shadow-md hover:-translate-y-0.5'
                                        }`}
                                    >
                                        {isProcessing ? (
                                            <span className="flex items-center justify-center gap-1">
                                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                </svg>
                                                Processing...
                                            </span>
                                        ) : '✨ Create Note'}
                                    </button>
                                </div>

                            </>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-stone-600 text-sm mb-6">Your note is being created. Please wait...</p>
                            </div>
                        )}
                    </div>
                )}
            </MOTION.div>

            <button
                onClick={() => navigate('/dashboard')}
                className="mt-8 text-stone-500 hover:text-stone-800 font-medium transition-colors z-10"
            >
                ← Back to Dashboard
            </button>
            </div>
        )
    );
}

