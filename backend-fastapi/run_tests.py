import os, sys

# prepare environment
os.environ.setdefault("TESTING", "1")

sys.path.append(os.path.dirname(__file__))

from tests import test_api
from core.config import settings

print("settings.testing?", settings.testing)

for name in dir(test_api):
    if name.startswith("test_"):
        print("running", name)
        try:
            getattr(test_api, name)()
            print(name, "ok")
        except Exception as e:
            print(name, "FAILED", e)
            raise
print("done")
