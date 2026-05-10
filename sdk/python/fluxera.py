# sdk/python/fluxera.py
# Fluxera SDK — Python
#
# Installation:  pip install fluxera-sdk
# Usage:
#   import fluxera
#   fluxera.init('fx_your_api_key')
#
#   @fluxera.track(endpoint='/v1/generate', price=0.04)
#   def call_my_api():
#       return openai.completions.create(...)
#
#   # Or manually:
#   result = fluxera.track_call(my_fn, endpoint='/v1/generate', price=0.04)

import time
import uuid
import json
import threading
import urllib.request
import urllib.error
import functools
from datetime import datetime, timezone

INGEST_URL    = 'https://api.fluxeratechnologies.ai/api/ingest'
BATCH_SIZE    = 50
FLUSH_INTERVAL = 30  # seconds


class FluxeraClient:
    def __init__(self, api_key: str, host: str = None, debug: bool = False):
        if not api_key or not api_key.startswith('fx_'):
            raise ValueError('[Fluxera] Invalid API key. Keys must start with fx_')

        self.api_key  = api_key
        self.url      = f'https://{host}/api/ingest' if host else INGEST_URL
        self.debug    = debug
        self._queue   = []
        self._lock    = threading.Lock()
        self._timer   = None
        self._start_timer()
        self._log('Fluxera SDK initialized')

    # ─────────────────────────────────────────────────────────────
    # track(fn, endpoint, price, request_id)
    # Wraps any callable. Captures success/fail + latency.
    # ─────────────────────────────────────────────────────────────
    def track_call(self, fn, endpoint: str = 'unknown', price: float = None, request_id: str = None):
        rid        = request_id or str(uuid.uuid4())
        started_at = time.time()
        status     = 'success'
        error_type = None

        try:
            result = fn()
            return result
        except Exception as exc:
            status     = 'fail'
            error_type = self._classify_error(exc)
            raise  # ALWAYS re-raise — never swallow
        finally:
            latency_ms = int((time.time() - started_at) * 1000)
            self._enqueue({
                'request_id': rid,
                'endpoint':   endpoint,
                'status':     status,
                'latency_ms': latency_ms,
                'price':      price,
                'error_type': error_type,
                'timestamp':  datetime.now(timezone.utc).isoformat(),
            })

    # ─────────────────────────────────────────────────────────────
    # Decorator: @fluxera.track(endpoint='/v1/generate', price=0.04)
    # ─────────────────────────────────────────────────────────────
    def track(self, endpoint: str = 'unknown', price: float = None):
        def decorator(fn):
            @functools.wraps(fn)
            def wrapper(*args, **kwargs):
                return self.track_call(
                    lambda: fn(*args, **kwargs),
                    endpoint=endpoint,
                    price=price,
                )
            return wrapper
        return decorator

    # ─────────────────────────────────────────────────────────────
    # async_track — for async functions
    # ─────────────────────────────────────────────────────────────
    def async_track(self, endpoint: str = 'unknown', price: float = None):
        def decorator(fn):
            @functools.wraps(fn)
            async def wrapper(*args, **kwargs):
                rid        = str(uuid.uuid4())
                started_at = time.time()
                status     = 'success'
                error_type = None
                try:
                    result = await fn(*args, **kwargs)
                    return result
                except Exception as exc:
                    status     = 'fail'
                    error_type = self._classify_error(exc)
                    raise
                finally:
                    latency_ms = int((time.time() - started_at) * 1000)
                    self._enqueue({
                        'request_id': rid,
                        'endpoint':   endpoint,
                        'status':     status,
                        'latency_ms': latency_ms,
                        'price':      price,
                        'error_type': error_type,
                        'timestamp':  datetime.now(timezone.utc).isoformat(),
                    })
            return wrapper
        return decorator

    # ─────────────────────────────────────────────────────────────
    # batch(logs) — send pre-collected logs directly
    # ─────────────────────────────────────────────────────────────
    def batch(self, logs: list):
        if logs:
            self._send(logs)

    def _enqueue(self, event: dict):
        with self._lock:
            self._queue.append(event)
            self._log(f"Queued: {event['endpoint']} → {event['status']} ({event['latency_ms']}ms)")
            if len(self._queue) >= BATCH_SIZE:
                self._flush_locked()

    def _start_timer(self):
        self._timer = threading.Timer(FLUSH_INTERVAL, self._timer_flush)
        self._timer.daemon = True  # don't block process exit
        self._timer.start()

    def _timer_flush(self):
        with self._lock:
            self._flush_locked()
        self._start_timer()

    def _flush_locked(self):
        if not self._queue:
            return
        batch = self._queue[:]
        self._queue = []
        threading.Thread(target=self._send, args=(batch,), daemon=True).start()

    def flush(self):
        with self._lock:
            self._flush_locked()

    def _send(self, logs: list):
        body = json.dumps({'logs': logs}).encode('utf-8')
        req  = urllib.request.Request(
            self.url,
            data    = body,
            method  = 'POST',
            headers = {
                'Content-Type':  'application/json',
                'Authorization': f'Bearer {self.api_key}',
                'User-Agent':    'fluxera-python-sdk/1.0.0',
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                self._log(f'Sent {len(logs)} events → {resp.status}')
        except Exception as exc:
            self._log(f'Send failed (non-fatal): {exc}')

    def _classify_error(self, exc) -> str:
        msg  = str(exc).lower()
        code = getattr(exc, 'status', None) or getattr(exc, 'status_code', None) or 0
        if 'timeout' in msg or code in (408, 504): return 'timeout'
        if 'rate'    in msg or code == 429:        return 'rate_limit'
        if code >= 500:                            return 'server_error'
        if code in (401, 403):                     return 'auth_error'
        if 'context' in msg or 'token' in msg:    return 'context_length'
        if code >= 400:                            return 'invalid_request'
        return 'unknown'

    def _log(self, *args):
        if self.debug:
            print('[Fluxera]', *args)

    def __del__(self):
        if self._timer:
            self._timer.cancel()
        self.flush()


# ─── MODULE-LEVEL SINGLETON ───────────────────────────────────────────────────
# Allows: import fluxera; fluxera.init('fx_...'); @fluxera.track(...)

_client = None

def init(api_key: str, **kwargs):
    global _client
    _client = FluxeraClient(api_key, **kwargs)
    return _client

def track(endpoint: str = 'unknown', price: float = None):
    if not _client:
        raise RuntimeError('[Fluxera] Call fluxera.init(api_key) first')
    return _client.track(endpoint=endpoint, price=price)

def async_track(endpoint: str = 'unknown', price: float = None):
    if not _client:
        raise RuntimeError('[Fluxera] Call fluxera.init(api_key) first')
    return _client.async_track(endpoint=endpoint, price=price)

def track_call(fn, endpoint: str = 'unknown', price: float = None):
    if not _client:
        raise RuntimeError('[Fluxera] Call fluxera.init(api_key) first')
    return _client.track_call(fn, endpoint=endpoint, price=price)

def flush():
    if _client:
        _client.flush()
