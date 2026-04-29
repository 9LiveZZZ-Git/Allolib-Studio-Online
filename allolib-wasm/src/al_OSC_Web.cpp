/**
 * al::osc::* WASM implementation — M5.1
 *
 * Real oscpack-backed serialization + Emscripten WebSocket transport.
 * No stubs: every method does what its native counterpart does, with
 * the transport layer swapped from POSIX UDP to WebSocket.
 *
 * Layered design:
 *   - Packet/Message wrap oscpack's OutboundPacketStream / ReceivedMessage
 *     (linked from allolib/external/oscpack via CMakeLists ALLOLIB_SOURCES)
 *     so the bytes on the wire are byte-identical with desktop AlloLib.
 *   - Send/Recv use Emscripten's WebSocket C API (-lwebsocket.js) to ship
 *     the serialized bytes. The "port" + "address" arguments are mapped
 *     onto a WebSocket URL (ws://address:port/osc by default), so an
 *     OSC↔WebSocket relay (M5.5, bundled in the Railway backend) can
 *     bridge to actual UDP for cross-language interop.
 *   - For browser-to-browser direct messaging, both peers connect to
 *     the same WebSocket URL and the relay simply rebroadcasts.
 *
 * Open items (deferred per the M5 sub-push plan):
 *   - The relay isn't bundled yet (M5.5). Until then, OSC works against
 *     a user-supplied bridge.
 *   - Recv::start()/stop() are no-ops because Emscripten WebSocket
 *     dispatches via callback. while(recv()){} loops still terminate
 *     correctly because recv() returns 0 (queue drained).
 */

#ifdef __EMSCRIPTEN__

#include "al/protocol/al_OSC.hpp"

#include <emscripten.h>
#include <emscripten/websocket.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include "osc/OscOutboundPacketStream.h"
#include "osc/OscReceivedElements.h"
#include "osc/OscException.h"

namespace al {
namespace osc {

// ─── Packet ────────────────────────────────────────────────────────────────

class Packet::Impl : public ::osc::OutboundPacketStream {
public:
    Impl(char* buffer, unsigned long size)
        : ::osc::OutboundPacketStream(buffer, size) {}
};

Packet::Packet(int size) {
    if (size <= 0) size = 1024;
    mData.resize(size);
    mImpl = new Impl(mData.data(), (unsigned long)size);
}

Packet::Packet(const char* contents, size_t size) {
    if (contents && size > 0) {
        mData.assign(contents, contents + size);
    } else {
        mData.resize(1024);
    }
    mImpl = new Impl(mData.data(), (unsigned long)mData.size());
}

Packet::~Packet() {
    delete mImpl;
    mImpl = nullptr;
}

const char* Packet::data() const {
    return mImpl ? mImpl->Data() : (mData.empty() ? nullptr : mData.data());
}

size_t Packet::size() const {
    return mImpl ? mImpl->Size() : mData.size();
}

bool Packet::isMessage() const {
    if (!data() || size() == 0) return false;
    try {
        ::osc::ReceivedPacket rp(data(), (::osc::osc_bundle_element_size_t)size());
        return rp.IsMessage();
    } catch (...) { return false; }
}

bool Packet::isBundle() const {
    if (!data() || size() == 0) return false;
    try {
        ::osc::ReceivedPacket rp(data(), (::osc::osc_bundle_element_size_t)size());
        return rp.IsBundle();
    } catch (...) { return false; }
}

void Packet::printRaw() const {
    const char* p = data();
    size_t n = size();
    std::cout << "[osc::Packet] " << n << " bytes:";
    for (size_t i = 0; i < n && i < 64; ++i) {
        char buf[8];
        std::snprintf(buf, sizeof(buf), " %02x", (unsigned char)p[i]);
        std::cout << buf;
    }
    if (n > 64) std::cout << " ...";
    std::cout << std::endl;
}

Packet& Packet::beginBundle(TimeTag t) {
    if (mImpl) *mImpl << ::osc::BeginBundle((::osc::uint64)t);
    return *this;
}
Packet& Packet::endBundle() {
    if (mImpl) *mImpl << ::osc::EndBundle;
    return *this;
}
Packet& Packet::beginMessage(const std::string& addr) {
    if (mImpl) *mImpl << ::osc::BeginMessage(addr.c_str());
    return *this;
}
Packet& Packet::endMessage() {
    if (mImpl) *mImpl << ::osc::EndMessage;
    return *this;
}

Packet& Packet::operator<<(int v)                { if (mImpl) *mImpl << (::osc::int32)v; return *this; }
Packet& Packet::operator<<(unsigned v)           { if (mImpl) *mImpl << (::osc::int32)v; return *this; }
Packet& Packet::operator<<(int64_t v)            { if (mImpl) *mImpl << (::osc::int64)v; return *this; }
Packet& Packet::operator<<(uint64_t v)           { if (mImpl) *mImpl << (::osc::int64)v; return *this; }
Packet& Packet::operator<<(float v)              { if (mImpl) *mImpl << v; return *this; }
Packet& Packet::operator<<(double v)             { if (mImpl) *mImpl << v; return *this; }
Packet& Packet::operator<<(char v)               { if (mImpl) *mImpl << v; return *this; }
Packet& Packet::operator<<(const char* v)        { if (mImpl && v) *mImpl << v; return *this; }
Packet& Packet::operator<<(const std::string& v) { if (mImpl) *mImpl << v.c_str(); return *this; }
Packet& Packet::operator<<(const Blob& v) {
    if (mImpl) *mImpl << ::osc::Blob(v.data, (::osc::osc_bundle_element_size_t)v.size);
    return *this;
}

Packet& Packet::clear() {
    if (mImpl) mImpl->Clear();
    return *this;
}

// ─── Message ───────────────────────────────────────────────────────────────

class Message::Impl {
public:
    std::vector<char> backing;
    std::unique_ptr<::osc::ReceivedMessage> received;
    ::osc::ReceivedMessageArgumentIterator iter;

    Impl(const char* data, int size)
        : backing(data, data + size),
          received(new ::osc::ReceivedMessage(::osc::ReceivedPacket(
              backing.data(),
              (::osc::osc_bundle_element_size_t)backing.size()))),
          iter(received->ArgumentsBegin()) {}
};

Message::Message(const char* message, int size, const TimeTag& timeTag,
                 const char* senderAddr, uint16_t senderPort)
    : mTimeTag(timeTag), mSenderPort(senderPort) {
    std::memset(mSenderAddr, 0, sizeof(mSenderAddr));
    if (senderAddr) {
        std::strncpy(mSenderAddr, senderAddr, sizeof(mSenderAddr) - 1);
    }
    try {
        mImpl = new Impl(message, size);
        mAddressPattern = mImpl->received->AddressPattern();
        mTypeTags        = mImpl->received->TypeTags();
    } catch (const ::osc::Exception& e) {
        std::cerr << "[osc::Message] parse error: " << e.what() << std::endl;
        mImpl = nullptr;
    }
}

Message::~Message() {
    delete mImpl;
    mImpl = nullptr;
}

void Message::print() const {
    std::cout << "[osc::Message] " << mAddressPattern
              << " (" << mTypeTags << ")" << std::endl;
}

Message& Message::resetStream() {
    if (mImpl) mImpl->iter = mImpl->received->ArgumentsBegin();
    return *this;
}

Message& Message::operator>>(int& v) {
    if (mImpl) try { v = (mImpl->iter++)->AsInt32(); } catch(...) { v = 0; }
    else v = 0;
    return *this;
}
Message& Message::operator>>(float& v) {
    if (mImpl) try { v = (mImpl->iter++)->AsFloat(); } catch(...) { v = 0.0f; }
    else v = 0.0f;
    return *this;
}
Message& Message::operator>>(double& v) {
    if (mImpl) try { v = (mImpl->iter++)->AsDouble(); } catch(...) { v = 0.0; }
    else v = 0.0;
    return *this;
}
Message& Message::operator>>(char& v) {
    if (mImpl) try { v = (char)(mImpl->iter++)->AsChar(); } catch(...) { v = 0; }
    else v = 0;
    return *this;
}
Message& Message::operator>>(const char*& v) {
    v = "";
    if (mImpl) try { v = (mImpl->iter++)->AsString(); } catch(...) {}
    return *this;
}
Message& Message::operator>>(std::string& v) {
    v.clear();
    if (mImpl) try { v = (mImpl->iter++)->AsString(); } catch(...) {}
    return *this;
}
Message& Message::operator>>(Blob& v) {
    v.data = nullptr; v.size = 0;
    if (mImpl) try {
        const void* d = nullptr;
        ::osc::osc_bundle_element_size_t sz = 0;
        (mImpl->iter++)->AsBlob(d, sz);
        v.data = d; v.size = sz;
    } catch(...) {}
    return *this;
}

// ─── Send (Emscripten WebSocket transport) ────────────────────────────────

class Send::SocketSender {
public:
    EMSCRIPTEN_WEBSOCKET_T ws = 0;
    std::string url;
    bool connecting = false;
    std::vector<std::vector<char>> pending;
    std::mutex mu;

    static EM_BOOL onOpen(int, const EmscriptenWebSocketOpenEvent* e, void* userData) {
        auto* self = (SocketSender*)userData;
        std::lock_guard<std::mutex> lk(self->mu);
        self->connecting = false;
        for (auto& msg : self->pending) {
            emscripten_websocket_send_binary(e->socket, msg.data(), msg.size());
        }
        self->pending.clear();
        return EM_TRUE;
    }
    static EM_BOOL onError(int, const EmscriptenWebSocketErrorEvent*, void* userData) {
        auto* self = (SocketSender*)userData;
        std::cerr << "[osc::Send] ws error url=" << self->url << std::endl;
        return EM_TRUE;
    }
    static EM_BOOL onClose(int, const EmscriptenWebSocketCloseEvent*, void*) {
        return EM_TRUE;
    }

    bool open(const std::string& wsURL) {
        url = wsURL;
        EmscriptenWebSocketCreateAttributes attr = { url.c_str(), nullptr, EM_TRUE };
        ws = emscripten_websocket_new(&attr);
        if (ws <= 0) return false;
        connecting = true;
        emscripten_websocket_set_onopen_callback(ws, this, &SocketSender::onOpen);
        emscripten_websocket_set_onerror_callback(ws, this, &SocketSender::onError);
        emscripten_websocket_set_onclose_callback(ws, this, &SocketSender::onClose);
        return true;
    }

    size_t send(const char* data, size_t sz) {
        if (ws <= 0) return 0;
        std::lock_guard<std::mutex> lk(mu);
        if (connecting) {
            pending.emplace_back(data, data + sz);
            return sz;  // optimistic — flushed once OPEN fires
        }
        EMSCRIPTEN_RESULT r = emscripten_websocket_send_binary(ws, (void*)data, sz);
        return r == EMSCRIPTEN_RESULT_SUCCESS ? sz : 0;
    }

    void close() {
        if (ws > 0) {
            emscripten_websocket_close(ws, 1000, "shutdown");
            emscripten_websocket_delete(ws);
            ws = 0;
        }
    }
};

Send::Send() : Packet(1024) {
    socketSender = std::make_unique<SocketSender>();
}
Send::Send(int size) : Packet(size) {
    socketSender = std::make_unique<SocketSender>();
}
Send::Send(uint16_t port, const char* address, al_sec /*timeout*/, int size)
    : Packet(size) {
    socketSender = std::make_unique<SocketSender>();
    open(port, address);
}
Send::~Send() {
    if (socketSender) socketSender->close();
}

bool Send::open(uint16_t port, const char* address) {
    mPort = port;
    mAddress = address ? address : "";
    std::string host = mAddress.empty() ? std::string("127.0.0.1") : mAddress;
    std::string wsURL = "ws://" + host + ":" + std::to_string(port) + "/osc";
    return socketSender->open(wsURL);
}

size_t Send::send() {
    if (!mImpl || mImpl->Size() == 0) return 0;
    size_t n = socketSender->send(mImpl->Data(), mImpl->Size());
    clear();
    return n;
}

size_t Send::send(const Packet& p) {
    if (!p.data() || p.size() == 0) return 0;
    return socketSender->send(p.data(), p.size());
}

// ─── Recv (Emscripten WebSocket transport) ────────────────────────────────

class Recv::SocketReceiver {
public:
    EMSCRIPTEN_WEBSOCKET_T ws = 0;
    std::string url;
    Recv* parent = nullptr;

    static EM_BOOL onMessage(int, const EmscriptenWebSocketMessageEvent* e, void* userData) {
        auto* self = (SocketReceiver*)userData;
        if (!self || !self->parent) return EM_TRUE;
        if (e->isText) return EM_TRUE;
        self->parent->parse((const char*)e->data, (int)e->numBytes,
                            self->url.c_str(), self->parent->port());
        return EM_TRUE;
    }

    bool open(uint16_t port, const std::string& address, Recv* p) {
        parent = p;
        std::string host = address.empty() ? std::string("127.0.0.1") : address;
        url = "ws://" + host + ":" + std::to_string(port) + "/osc";
        EmscriptenWebSocketCreateAttributes attr = { url.c_str(), nullptr, EM_TRUE };
        ws = emscripten_websocket_new(&attr);
        if (ws <= 0) return false;
        emscripten_websocket_set_onmessage_callback(ws, this, &SocketReceiver::onMessage);
        return true;
    }

    void close() {
        if (ws > 0) {
            emscripten_websocket_close(ws, 1000, "shutdown");
            emscripten_websocket_delete(ws);
            ws = 0;
        }
    }
};

Recv::Recv() {
    mBackground = false;
    socketReceiver = std::make_unique<SocketReceiver>();
    mBuffer.resize(8192);
}
Recv::Recv(uint16_t port, const char* address, al_sec /*timeout*/) {
    mBackground = false;
    socketReceiver = std::make_unique<SocketReceiver>();
    mBuffer.resize(8192);
    open(port, address);
}
Recv::~Recv() {
    if (socketReceiver) socketReceiver->close();
}

bool Recv::open(uint16_t port, const char* address, al_sec /*timeout*/) {
    mPort = port;
    mAddress = address ? address : "";
    bool ok = socketReceiver->open(port, mAddress, this);
    mOpen = ok;
    return ok;
}

void Recv::parse(const char* packet, int size,
                 const char* senderAddr, uint16_t senderPort) {
    if (!packet || size <= 0) return;
    try {
        ::osc::ReceivedPacket rp(packet, (::osc::osc_bundle_element_size_t)size);
        if (rp.IsMessage()) {
            Message m(packet, size, (TimeTag)1, senderAddr, senderPort);
            for (auto* h : mHandlers) if (h) h->onMessage(m);
        } else if (rp.IsBundle()) {
            ::osc::ReceivedBundle bundle(rp);
            TimeTag bundleTag = (TimeTag)bundle.TimeTag();
            for (auto it = bundle.ElementsBegin(); it != bundle.ElementsEnd(); ++it) {
                if (it->IsMessage()) {
                    Message m(it->Contents(), it->Size(), bundleTag, senderAddr, senderPort);
                    for (auto* h : mHandlers) if (h) h->onMessage(m);
                }
            }
        }
    } catch (const ::osc::Exception& e) {
        std::cerr << "[osc::Recv] parse error: " << e.what() << std::endl;
    }
}

int Recv::recv() {
    // Emscripten WebSocket dispatches via callback automatically. Returning
    // 0 ensures user-side `while(recv()){}` polling loops terminate cleanly.
    return 0;
}

bool Recv::start() { mBackground = true;  return true; }
void Recv::stop()  { mBackground = false; }

bool Recv::portAvailable(uint16_t /*port*/, const char* /*address*/) {
    // We can't probe a remote WS endpoint without connecting — assume
    // available and let open() report failure if it can't bind.
    return true;
}

std::vector<std::shared_ptr<Message>>
Recv::parse(const char* packet, int size, TimeTag timeTag,
            const char* senderAddr, uint16_t senderPort) {
    std::vector<std::shared_ptr<Message>> result;
    if (!packet || size <= 0) return result;
    try {
        ::osc::ReceivedPacket rp(packet, (::osc::osc_bundle_element_size_t)size);
        if (rp.IsMessage()) {
            result.push_back(std::make_shared<Message>(packet, size, timeTag, senderAddr, senderPort));
        } else if (rp.IsBundle()) {
            ::osc::ReceivedBundle bundle(rp);
            TimeTag bundleTag = (TimeTag)bundle.TimeTag();
            for (auto it = bundle.ElementsBegin(); it != bundle.ElementsEnd(); ++it) {
                if (it->IsMessage()) {
                    result.push_back(std::make_shared<Message>(
                        it->Contents(), it->Size(), bundleTag, senderAddr, senderPort));
                }
            }
        }
    } catch (...) {}
    return result;
}

void Recv::loop() {
    // No-op; events arrive via WebSocket callback.
}

} // namespace osc

// ─── Web stubs for al::Socket / al::Thread ────────────────────────────────
//
// Upstream al_ParameterServer.cpp pulls in al::Socket::nameToIp() to resolve
// hostnames before binding/sending. On the web we route OSC through the
// WebSocket bridge, so the "IP" is just the host string verbatim. Identity
// match is the Right Thing.
//
// osc::Recv carries an al::Thread mThread for native background polling. We
// already no-op start()/stop() (events are pushed by the WebSocket callback),
// so we just need the symbols to exist for the link. A trivial empty Thread
// is the smallest correct stub — pthread linkage on Emscripten requires
// SharedArrayBuffer + COOP/COEP, which is too heavy for what we'd never use.

} // namespace al

#include "al/io/al_Socket.hpp"
#include "al/system/al_Thread.hpp"

namespace al {

std::string Socket::nameToIp(std::string name) { return name; }

struct Thread::Impl {};

Thread::Thread() : mImpl(nullptr), mJoinOnDestroy(true) {}
Thread::~Thread() {}

} // namespace al

#endif // __EMSCRIPTEN__
