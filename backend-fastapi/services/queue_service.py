from queue import Queue
import threading
import logging
from services import processing_service

logger = logging.getLogger(__name__)

task_queue = Queue()


def worker():
    while True:
        task = task_queue.get()

        if task is None:
            logger.info("worker received shutdown signal")
            break

        lecture_id, file_location = task
        logger.debug("processing lecture %s", lecture_id)
        try:
            processing_service.process_lecture(
                lecture_id,
                file_location
            )
        except Exception:
            logger.exception("error processing lecture %s", lecture_id)
        finally:
            task_queue.task_done()


# start worker thread unless we're running in a test session
from core.config import settings

if not settings.testing:
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
else:
    logger.info("queue_service running in testing mode; worker thread not started")


def add_task(lecture_id: int, file_location: str):
    """Enqueue a lecture for background processing."""
    task_queue.put((lecture_id, file_location))
