"""Loaded by Python at startup when test/python is on PYTHONPATH, for the tests only: an example's calls to
services.carbium.sh go to the stand-in on 127.0.0.1:$STANDIN_PORT instead, over httpx (HTTP) and over asyncio's
create_connection (the WebSocket). The example is not changed, and nothing here ships with it."""
import asyncio
import os

import httpx

HOST = "services.carbium.sh"
PORT = int(os.environ["STANDIN_PORT"])


def _local(request: httpx.Request) -> None:
    if request.url.host == HOST:
        request.url = request.url.copy_with(scheme="http", host="127.0.0.1", port=PORT)


_handle = httpx.HTTPTransport.handle_request
_handle_async = httpx.AsyncHTTPTransport.handle_async_request
_create_connection = asyncio.BaseEventLoop.create_connection


def handle_request(self, request):
    _local(request)
    return _handle(self, request)


async def handle_async_request(self, request):
    _local(request)
    return await _handle_async(self, request)


async def create_connection(self, protocol_factory, host=None, port=None, **kwargs):
    if host == HOST:
        host, port = "127.0.0.1", PORT
        kwargs.pop("ssl", None)
        kwargs.pop("server_hostname", None)
    return await _create_connection(self, protocol_factory, host, port, **kwargs)


httpx.HTTPTransport.handle_request = handle_request
httpx.AsyncHTTPTransport.handle_async_request = handle_async_request
asyncio.BaseEventLoop.create_connection = create_connection
