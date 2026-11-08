import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/logo.jpeg';

export default function HeroPage() {
    const { token } = useAuth();

    return (
        <div className="min-h-screen bg-cream font-sans">
            <nav className="border-b border-stone-200 bg-cream/95">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-2xl font-serif text-stone-800">
                        <img src={logoImage} alt="Morom Notes logo" className="h-10 w-10 object-contain rounded-[30%] opacity-50" />
                        Morom Notes
                    </div>
                    {token ? (
                        <Link to="/" className="text-sm font-medium text-stone-700 hover:text-stone-900">Dashboard</Link>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link to="/login" className="text-sm text-stone-600 hover:text-stone-900">Log in</Link>
                            <Link to="/signup" className="px-4 py-2 rounded-lg bg-stone-800 text-white text-sm hover:bg-stone-900">Sign up</Link>
                        </div>
                    )}
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center relative">
                <div className="absolute inset-0 pattern-dots text-stone-300 opacity-20 pointer-events-none" />
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative">
                    <p className="text-sm uppercase tracking-[0.2em] text-blue-600 font-medium mb-5">YouTube to study notes</p>
                    <h1 className="text-4xl sm:text-6xl font-display font-medium text-stone-800 leading-tight">
                        Learn faster from every lecture.
                    </h1>
                    <p className="max-w-2xl mx-auto mt-6 text-lg text-stone-600">
                        Paste a YouTube link and get clear, structured notes ready to review, edit, and export.
                    </p>
                    <div className="mt-9 flex justify-center gap-3">
                        <Link to={token ? '/upload' : '/signup'} className="px-6 py-3 rounded-lg bg-stone-800 text-white font-medium hover:bg-stone-900">
                            Create notes
                        </Link>
                        {!token && <Link to="/login" className="px-6 py-3 rounded-lg border border-stone-300 text-stone-700 font-medium hover:bg-white">Log in</Link>}
                    </div>
                </motion.div>

                <div className="relative mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                    {[
                        ['01', 'Paste a link', 'Use any supported YouTube lecture or video.'],
                        ['02', 'Generate notes', 'AI extracts the key ideas and structure.'],
                        ['03', 'Study your way', 'Edit, organize, and export your notes.'],
                    ].map(([number, title, description]) => (
                        <div key={number} className="bg-paper border border-stone-200 rounded-xl p-5">
                            <span className="text-sm text-blue-600 font-semibold">{number}</span>
                            <h2 className="mt-3 text-lg font-medium text-stone-800">{title}</h2>
                            <p className="mt-2 text-sm text-stone-600">{description}</p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
