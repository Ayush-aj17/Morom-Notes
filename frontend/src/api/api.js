// base URL for backend; configure using VITE_API_BASE_URL in .env.local for production
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/* ---------- Upload Lecture ---------- */
export const authFetch = async (path, options = {}) => {
  // Check both possible token locations
  const tokenFromCurrentToken = localStorage.getItem('currentToken');
  const tokenFromLegacyToken = localStorage.getItem('token');
  const token = tokenFromCurrentToken || tokenFromLegacyToken;
  
  const headers = options.headers ? { ...options.headers } : {};
  
  // Debug: Log token retrieval
  console.log(`\n[authFetch] ====== REQUEST ======`);
  console.log(`[authFetch] Path: ${path}`);
  console.log(`[authFetch] Token sources:`, {
    currentTokenExists: !!tokenFromCurrentToken,
    legacyTokenExists: !!tokenFromLegacyToken,
    finalTokenExists: !!token
  });
  
  // Don't add token for auth endpoints (public endpoints)
  const isAuthEndpoint = path.includes('/auth/signup') || 
                        path.includes('/auth/login') || 
                        path.includes('/auth/request-otp') ||
                        path.includes('/auth/verify-otp') ||
                        path.includes('/auth/forgot-password');
  
  console.log(`[authFetch] Is auth endpoint: ${isAuthEndpoint}`);
  
  if (token && !isAuthEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log(`[authFetch] ✓ Authorization header added`);
    console.log(`[authFetch] Token: ${token.substring(0, 40)}...`);
  } else if (!token && !isAuthEndpoint) {
    console.error(`[authFetch] ❌ NO TOKEN for protected endpoint!`);
    console.error(`[authFetch] localStorage.currentToken: ${localStorage.getItem('currentToken')}`);
    console.error(`[authFetch] localStorage.token: ${localStorage.getItem('token')}`);
  }

  // Only set Content-Type if body is provided AND Content-Type isn't already set
  // Don't set it if body is FormData or URLSearchParams (let browser auto-detect)
  if (options.body && !headers['Content-Type']) {
    if (!(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) {
      headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    
    console.log(`[authFetch] Response status: ${res.status}`);
    
    if (res.status === 401) {
      console.error(`[authFetch] ❌ 401 Unauthorized on ${path}`);
      console.error('[authFetch] Possible causes:');
      console.error('  1. Token not in localStorage');
      console.error('  2. Token is expired');
      console.error('  3. Token format incompatible');
      localStorage.removeItem('currentToken');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    
    console.log(`[authFetch] ====== END ======\n`);
    return res;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

export const uploadLectureAPI = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch(`/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Upload failed");
  return await res.json();
};

/* ---------- Get All Lectures ---------- */
export const getLecturesAPI = async () => {
  const res = await authFetch(`/lectures`);
  if (!res.ok) throw new Error("Failed to fetch lectures");
  return await res.json();
};


/* ---------- Get Single Lecture (optional future use) ---------- */
export const getLectureByIdAPI = async (id) => {
  const res = await authFetch(`/lectures/${id}`);
  if (!res.ok) throw new Error("Failed to fetch lecture");
  return await res.json();
};


export const aiEditAPI = async (notes, instruction) => {
  const res = await authFetch(`/ai-edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes, instruction }),
  });
  return await res.json();
};


export const exportPdfAPI = async (content) => {
  const res = await authFetch(`/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "notes.pdf";
  a.click();
};
