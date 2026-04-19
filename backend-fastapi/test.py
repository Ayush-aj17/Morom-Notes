"""Deprecated demo script for hand-crafted HTTP requests.

This file is kept only for reference and is not executed by the project. It
can be removed as part of cleaning up the repository.
"""

import urllib.request, json, urllib.error
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8000')

# sample request (commented out):
# req = urllib.request.Request(
#     f"{BASE}/auth/signup", 
#     data=b'{"username":"ayush999", "password":"123"}', 
#     headers={'Content-Type':'application/json'}
# )
# with urllib.request.urlopen(req) as response:
#     print(response.read())
