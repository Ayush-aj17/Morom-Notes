import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/logo.jpeg';

export default function HeroPage() {
    const { token } = useAuth();

    const fadeInUp = {
        initial: { opacity: 0, y: 30 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.6 }
    };

    const features = [
        {
            icon: "⚡",
            title: "Instant Video Summaries",
            description: "Paste a YouTube link or upload a video lecture. Our AI instantly extracts transcripts and organizes the material into logical, easy-to-read structured study notes."
        },
        {
            icon: "🧠",
            title: "Smart Document Extraction",
            description: "Upload PDFs, PowerPoints, or images. We automatically parse slides, text, and visual context so you never miss a detail from your professor's presentation."
        },
        {
            icon: "🎙️",
            title: "Flawless Audio Transcription",
            description: "Perfect for recorded meetings or audio lectures. Upload your audio files to get highly accurate transcripts transformed into bulleted summaries instantly."
        },
        {
            icon: "📝",
            title: "Notion-Style Rich Editor",
            description: "A beautiful, interactive workspace to edit your AI-generated notes. Organize with folders, bold formatting, and markdown support tailored specifically for students."
        },
        {
            icon: "🎓",
            title: "AI-Powered Study Guides",
            description: "Stop spending hours manually writing notes. Our AI analyzes the core concepts and automatically generates comprehensive study guides and flashcard-ready points."
        },
        {
            icon: "🖨️",
            title: "Print-Ready PDF Exports",
            description: "Take your notes anywhere. With one click, export your perfectly formatted study materials into clean, professional PDFs ready for printing and offline review."
        }
    ];

    const steps = [
        {
            number: "1",
            title: "Create Account",
            details: [
                "Click 'Sign Up' to create a new account",
                "Start using your secure personal workspace",
                "Keep your credentials safe for future logins"
            ]
        },
        {
            number: "2",
            title: "Upload or Link Media",
            details: [
                "Go to the 'Upload' section for your note generation",
                "Select a file (Video, Audio, PDF, PPT, Image)",
                "Or paste a valid YouTube URL for instant processing"
            ]
        },
        {
            number: "3",
            title: "Choose Pipeline & Generate",
            details: [
                "Select between 'Audio & Video' or 'Audio-Only' pipelines",
                "Our system will process it and extract precise transcripts",
                "Watch as AI instantly constructs your comprehensive study notes"
            ]
        },
        {
            number: "4",
            title: "Review & Edit Notes",
            details: [
                "Open the generated notes in the interactive editor",
                "Use the AI study buddy to refine or summarize content",
                "Add your own formatting, bullet points, and structures"
            ]
        },
        {
            number: "5",
            title: "Organize & Favorite",
            details: [
                "Sort notes by Manual order, Created Date, or Last Opened",
                "Move loose notes into dedicated Folders",
                "Mark important notes as Favorites for quick access"
            ]
        },
        {
            number: "6",
            title: "Export & Print",
            details: [
                "Click the Print icon on any note",
                "Export your formatted notes as a PDF document",
                "Maintain perfect styling for offline studying"
            ]
        }
    ];

    return (
        <div className="bg-cream min-h-screen overflow-hidden font-sans">
            {/* Navigation Header */}
            <motion.nav
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="fixed top-0 w-full z-50 bg-cream/95 backdrop-blur border-b border-stone-200"
            >
                <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
                    <div className="text-2xl sm:text-3xl md:text-4xl font-serif text-stone-800 tracking-wide flex items-center gap-2 sm:gap-3">
                        <img src={logoImage} alt="Morom Notes logo" className="h-8 sm:h-10 md:h-12 w-8 sm:w-10 md:w-12 object-contain opacity-40 rounded-[30%]" />
                        <span className="inline">Morom Notes</span>
                    </div>
                    <div className="space-x-2 sm:space-x-4 flex flex-wrap justify-end">
                        {token ? (
                            <>
                                <Link to="/" className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-base text-stone-600 hover:text-stone-800 font-medium">
                                    Dashboard
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-base text-stone-600 hover:text-stone-800 font-medium">
                                    Login
                                </Link>
                                <Link to="/signup" className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base bg-stone-800 text-white rounded-lg hover:bg-stone-900 font-medium transition-all hover:shadow-md">
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </motion.nav>

            {/* Hero Section */}
            <section className="pt-20 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-20 px-3 sm:px-6 relative">
                <div className="absolute inset-0 pattern-dots text-stone-300 opacity-20 pointer-events-none"></div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-4xl mx-auto text-center relative z-10"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-display font-medium text-stone-800 mb-4 sm:mb-6 leading-tight"
                    >
                        Turn Any Lecture Into
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                            Perfect Study Notes
                        </span>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-stone-600 mb-6 sm:mb-8 md:mb-10 font-handwriting"
                    >
                        Instantly transform YouTube videos, PDFs, and lectures into comprehensive study guides using AI.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                        className="flex gap-2 sm:gap-3 md:gap-4 justify-center flex-wrap"
                    >
                        {!token && (
                            <>
                                <Link to="/login" className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 text-xs sm:text-sm md:text-base bg-stone-800 text-white rounded-lg md:rounded-xl hover:bg-stone-900 font-medium transition-all hover:shadow-lg transform hover:-translate-y-1 whitespace-nowrap">
                                    Start Learning
                                </Link>
                                <Link to="/signup" className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 text-xs sm:text-sm md:text-base border-2 border-stone-800 text-stone-800 rounded-lg md:rounded-xl hover:bg-stone-50 font-medium transition-all whitespace-nowrap">
                                    Create Account
                                </Link>
                            </>
                        )}
                        {token && (
                            <Link to="/" className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 text-xs sm:text-sm md:text-base bg-stone-800 text-white rounded-lg md:rounded-xl hover:bg-stone-900 font-medium transition-all hover:shadow-lg transform hover:-translate-y-1">
                                Go to Dashboard
                            </Link>
                        )}
                    </motion.div>
                </motion.div>
            </section>

            {/* Features Section */}
            <section className="py-12 sm:py-16 md:py-20 px-3 sm:px-6 relative">
                <div className="max-w-6xl mx-auto">
                    <motion.h2
                        {...fadeInUp}
                        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-medium text-stone-800 text-center mb-8 sm:mb-12 md:mb-16"
                    >
                        Your Study Advantages
                    </motion.h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                {...fadeInUp}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="p-4 sm:p-6 md:p-8 bg-paper border border-stone-200 rounded-lg sm:rounded-xl md:rounded-2xl hover:shadow-lg transition-all hover:border-stone-300"
                            >
                                <div className="text-3xl sm:text-4xl md:text-5xl mb-3 sm:mb-4">{feature.icon}</div>
                                <h3 className="text-base sm:text-lg md:text-xl font-medium text-stone-800 mb-2 sm:mb-3">{feature.title}</h3>
                                <p className="text-sm sm:text-base text-stone-600">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-12 sm:py-16 md:py-20 px-3 sm:px-6 bg-stone-50 relative">
                <div className="max-w-6xl mx-auto">
                    <motion.h2
                        {...fadeInUp}
                        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-medium text-stone-800 text-center mb-8 sm:mb-12 md:mb-16"
                    >
                        How to Get Started
                    </motion.h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                {...fadeInUp}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="relative"
                            >
                                <div className="bg-white border border-stone-200 rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-6 md:p-8 h-full">
                                    {/* Step Number Circle */}
                                    <div className="absolute -top-4 sm:-top-6 left-4 sm:left-8 w-8 sm:w-12 h-8 sm:h-12 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center font-display font-bold text-sm sm:text-lg shadow-lg">
                                        {step.number}
                                    </div>

                                    <h3 className="text-base sm:text-lg md:text-xl font-medium text-stone-800 mb-3 sm:mb-4 mt-3 sm:mt-4">{step.title}</h3>

                                    <ul className="space-y-2 sm:space-y-3">
                                        {step.details.map((detail, detailIndex) => (
                                            <li key={detailIndex} className="flex items-start gap-2 sm:gap-3">
                                                <span className="text-blue-600 font-bold mt-0.5 text-sm sm:text-base flex-shrink-0">•</span>
                                                <span className="text-xs sm:text-sm text-stone-600">{detail}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Connection Line */}
                                {index < steps.length - 1 && (
                                    <div className="hidden lg:block absolute top-1/2 -right-4 h-1 w-8 bg-gradient-to-r from-blue-600 to-transparent"></div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Detailed Walkthrough Section */}
            <section className="py-12 sm:py-16 md:py-20 px-3 sm:px-6">
                <div className="max-w-4xl mx-auto">
                    <motion.h2
                        {...fadeInUp}
                        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-medium text-stone-800 text-center mb-8 sm:mb-12 md:mb-16"
                    >
                        Feature Highlights
                    </motion.h2>

                    <div className="space-y-8 sm:space-y-10 md:space-y-12">
                        {/* Feature 1: Media & YouTube Processing */}
                        <motion.div
                            {...fadeInUp}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-center"
                        >
                            <div className="order-2 md:order-1">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl md:rounded-2xl p-6 sm:p-8 md:p-12 text-center">
                                    <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-4">🎥</div>
                                    <p className="text-xs sm:text-sm md:text-base text-stone-600">Upload & Process Media</p>
                                </div>
                            </div>
                            <div className="order-1 md:order-2">
                                <h3 className="text-lg sm:text-xl md:text-2xl font-medium text-stone-800 mb-2 sm:mb-4">Media Upload & YouTube Transcription</h3>
                                <p className="text-xs sm:text-sm md:text-base text-stone-600 mb-3 sm:mb-4">
                                    Simply upload your educational files (PDF, PPT, audio, video) or paste a YouTube URL. Our robust system automatically:
                                </p>
                                <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-stone-600">
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-blue-600 font-bold mt-0.5">✓</span>
                                        <span>Extracts rich transcripts using audio transcription</span>
                                    </li>
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-blue-600 font-bold mt-0.5">✓</span>
                                        <span>Performs powerful visual OCR directly on video frames</span>
                                    </li>
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-blue-600 font-bold mt-0.5">✓</span>
                                        <span>Natively processes YouTube video links seamlessly</span>
                                    </li>
                                </ul>
                            </div>
                        </motion.div>

                        {/* Feature 2: Note Building */}
                        <motion.div
                            {...fadeInUp}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-center"
                        >
                            <div>
                                <div className="bg-purple-50 border border-purple-200 rounded-lg sm:rounded-xl md:rounded-2xl p-6 sm:p-8 md:p-12 text-center">
                                    <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-4">📝</div>
                                    <p className="text-xs sm:text-sm md:text-base text-stone-600">Rich Text Editor</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl md:text-2xl font-medium text-stone-800 mb-2 sm:mb-4">Create Organized Notes</h3>
                                <p className="text-xs sm:text-sm md:text-base text-stone-600 mb-3 sm:mb-4">
                                    Our powerful editor helps you structure your learning:
                                </p>
                                <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-stone-600">
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-purple-600 font-bold mt-0.5">✓</span>
                                        <span>Format text with headings, bold, italics</span>
                                    </li>
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-purple-600 font-bold mt-0.5">✓</span>
                                        <span>Create bullet points and numbered lists</span>
                                    </li>
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-purple-600 font-bold mt-0.5">✓</span>
                                        <span>Save drafts automatically</span>
                                    </li>
                                </ul>
                            </div>
                        </motion.div>

                        {/* Feature 3: Links and References */}
                        <motion.div
                            {...fadeInUp}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-center"
                        >
                            <div className="order-2 md:order-1">
                                <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl md:rounded-2xl p-6 sm:p-8 md:p-12 text-center">
                                    <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-4">🔗</div>
                                    <p className="text-xs sm:text-sm md:text-base text-stone-600">Link Management</p>
                                </div>
                            </div>
                            <div className="order-1 md:order-2">
                                <h3 className="text-lg sm:text-xl md:text-2xl font-medium text-stone-800 mb-2 sm:mb-4">Embed Links & References</h3>
                                <p className="text-xs sm:text-sm md:text-base text-stone-600 mb-3 sm:mb-4">
                                    Keep all your resources in one place:
                                </p>
                                <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-stone-600">
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                                        <span>Add hyperlinks to external resources</span>
                                    </li>
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                                        <span>Reference video timestamps</span>
                                    </li>
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                                        <span>Organize with tags and categories</span>
                                    </li>
                                </ul>
                            </div>
                        </motion.div>

                        {/* Feature 4: AI Generation */}
                        <motion.div
                            {...fadeInUp}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-center"
                        >
                            <div>
                                <div className="bg-orange-50 border border-orange-200 rounded-lg sm:rounded-xl md:rounded-2xl p-6 sm:p-8 md:p-12 text-center">
                                    <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-4">✨</div>
                                    <p className="text-xs sm:text-sm md:text-base text-stone-600">AI Powered</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl md:text-2xl font-medium text-stone-800 mb-2 sm:mb-4">AI-Powered Content Generation</h3>
                                <p className="text-xs sm:text-sm md:text-base text-stone-600 mb-3 sm:mb-4">
                                    Let AI assist your learning process:
                                </p>
                                <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-stone-600">
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-orange-600 font-bold mt-0.5">✓</span>
                                        <span>Auto-generate summaries from videos</span>
                                    </li>
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-orange-600 font-bold mt-0.5">✓</span>
                                        <span>Create study guides automatically</span>
                                    </li>
                                    <li className="flex items-start gap-2 sm:gap-3">
                                        <span className="text-orange-600 font-bold mt-0.5">✓</span>
                                        <span>Generate practice questions</span>
                                    </li>
                                </ul>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-12 sm:py-16 md:py-20 px-3 sm:px-6 bg-gradient-to-r from-blue-600 to-purple-600 relative overflow-hidden">
                <div className="absolute inset-0 pattern-dots text-white opacity-10 pointer-events-none"></div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-4xl mx-auto text-center relative z-10"
                >
                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-medium text-white mb-3 sm:mb-4 md:mb-6">
                        Ready to Transform Your Learning?
                    </h2>
                    <p className="text-sm sm:text-base md:text-lg text-blue-100 mb-6 sm:mb-8 md:mb-10">
                        Join thousands of students who are taking smarter notes and learning more effectively.
                    </p>

                    <div className="flex gap-2 sm:gap-3 md:gap-4 justify-center flex-wrap">
                        {!token && (
                            <>
                                <Link to="/signup" className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 text-xs sm:text-sm md:text-base bg-white text-blue-600 rounded-lg md:rounded-xl hover:bg-blue-50 font-medium transition-all hover:shadow-lg transform hover:-translate-y-1">
                                    Get Started Free
                                </Link>
                                <Link to="/login" className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 text-xs sm:text-sm md:text-base border-2 border-white text-white rounded-lg md:rounded-xl hover:bg-white/10 font-medium transition-all">
                                    Login to Account
                                </Link>
                            </>
                        )}
                        {token && (
                            <Link to="/" className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 text-xs sm:text-sm md:text-base bg-white text-blue-600 rounded-lg md:rounded-xl hover:bg-blue-50 font-medium transition-all hover:shadow-lg transform hover:-translate-y-1">
                                Go to Dashboard
                            </Link>
                        )}
                    </div>
                </motion.div>
            </section>

            {/* Footer */}
            <motion.footer
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="bg-stone-800 text-white py-12 px-6"
            >
                <div className="max-w-6xl mx-auto text-center">
                    <div className="text-2xl font-display mb-4 flex items-center justify-center gap-2">
                        <img src={logoImage} alt="Morom Notes logo" className="h-8 sm:h-10 md:h-12 w-8 sm:w-10 md:w-12 object-contain opacity-40 rounded-[30%]" />
                        <span>Morom Notes</span>
                    </div>
                    <p className="text-stone-300 mb-8">Transform your learning with intelligent note-taking</p>
                    <p className="text-stone-500">© 2026 Project Notes. All rights reserved.</p>
                </div>
            </motion.footer>
        </div>
    );
}
