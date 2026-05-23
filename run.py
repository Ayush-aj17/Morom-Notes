import subprocess
import threading
import time
import re
import sys
import os
import signal

def start_tunnel_and_get_url():
    print("[TUNNEL] Requesting secure public URL from Cloudflare (this takes a few seconds)...")
    
    # We tunnel the frontend (Vite) port 5173
    proc = subprocess.Popen(
        ["cloudflared", "tunnel", "--url", "http://127.0.0.1:5173"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    url = None
    for line in proc.stdout:
        match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if match:
            url = match.group(0)
            break
            
    print("\n" + "="*70)
    print(f"   YOUR NEW PUBLIC URL IS READY! MUST OPEN THIS:   ")
    print(f"    {url}   ")
    print("="*70 + "\n")
    return proc, url

def apply_env_edits(url):
    print("[SETUP] Automatically updating .env configuration for proxying...")
    
    # 1. Update frontend .env
    frontend_env = os.path.join("frontend", ".env")
    if os.path.exists(frontend_env):
        with open(frontend_env, "r", encoding="utf-8") as f:
            content = f.read()
        
        if "VITE_API_BASE_URL=" in content:
            content = re.sub(r'VITE_API_BASE_URL=.*', f'VITE_API_BASE_URL=""', content)
        else:
            content += f'\nVITE_API_BASE_URL=""\n'
            
        with open(frontend_env, "w", encoding="utf-8") as f:
            f.write(content)
            
    # We already updated vite.config.js to have allowedHosts: true and the proxy setup
    # so we just skip messing with it to prevent syntax errors.

def run_backend():
    print("[BACKEND] Starting FastAPI on port 8000...")
    proc = subprocess.Popen(
        [sys.executable, "run_server.py"],
        cwd="backend-fastapi",
        stdout=subprocess.DEVNULL, # hide noisy background logs
        stderr=subprocess.STDOUT
    )
    return proc

def run_frontend():
    print("[FRONTEND] Starting Vite on port 5173...")
    proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        stdout=subprocess.DEVNULL, # hide noisy background logs
        stderr=subprocess.STDOUT,
        shell=True
    )
    return proc

if __name__ == "__main__":
    print("--- Starting Full Stack App with Cloudflare Tunnel ---")
    
    tunnel_proc, public_url = start_tunnel_and_get_url()
    
    if public_url:
        apply_env_edits(public_url)
        backend_proc = run_backend()
        frontend_proc = run_frontend()
        print("[INFO] Servers are warming up... Keep this terminal open!")
        print("[INFO] Press Ctrl+C to stop the servers.")
        
        try:
            # Keep reading tunnel out in background to keep pipes clear
            for line in tunnel_proc.stdout:
                pass
            tunnel_proc.wait()
        except KeyboardInterrupt:
            print("\nShutting down servers...")
        finally:
            backend_proc.terminate()
            frontend_proc.terminate()
            tunnel_proc.terminate()
            print("Shutdown complete.")
    else:
        print("[ERROR] Failed to get Cloudflare URL. Please ensure cloudflared is installed.")
        tunnel_proc.terminate()

