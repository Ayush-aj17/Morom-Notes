
import re
path = "src/pages/UploadPage.jsx"
c = open(path, "r", encoding="utf-8").read()

c = c.replace("const [progressInterval, setProgressInterval] = useState(null);", "const progressIntervalRef = useRef(null);")
c = c.replace("const [pseudoProgressInterval, setPseudoProgressInterval] = useState(null);", "const pseudoProgressIntervalRef = useRef(null);")

cleanup_old = """    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (progressInterval) clearInterval(progressInterval);
            if (pseudoProgressInterval) clearInterval(pseudoProgressInterval);
        };
    }, [progressInterval, pseudoProgressInterval]);"""

cleanup_new = """    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (pseudoProgressIntervalRef.current) clearInterval(pseudoProgressIntervalRef.current);
        };
    }, []);"""
c = c.replace(cleanup_old, cleanup_new)

pseudo_old = """            setPseudoProgressInterval(interval);
            return () => clearInterval(interval);"""
pseudo_new = """            pseudoProgressIntervalRef.current = interval;
            return () => clearInterval(interval);"""
c = c.replace(pseudo_old, pseudo_new)

stop_old = """    const stopAllProgressTimers = () => {
        if (progressInterval) clearInterval(progressInterval);
        if (pseudoProgressInterval) clearInterval(pseudoProgressInterval);
        setProgressInterval(null);
        setPseudoProgressInterval(null);
    };"""
stop_new = """    const stopAllProgressTimers = () => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (pseudoProgressIntervalRef.current) clearInterval(pseudoProgressIntervalRef.current);
        progressIntervalRef.current = null;
        pseudoProgressIntervalRef.current = null;
    };"""
c = c.replace(stop_old, stop_new)

start_old = """        const interval = setInterval(() => fetchProgress(noteId), 500);
        setProgressInterval(interval);"""
start_new = """        const interval = setInterval(() => fetchProgress(noteId), 500);
        progressIntervalRef.current = interval;"""
c = c.replace(start_old, start_new)

open(path, "w", encoding="utf-8").write(c)
print("Intervals patched!")

