/**
 * Web-specific OSC stub implementation
 *
 * OSC (Open Sound Control) is a networking protocol that doesn't work
 * in the browser. This provides stub implementations to allow AlloLib
 * code that uses Parameter synchronization to compile.
 *
 * For actual web networking, WebSocket would be used instead.
 */

#ifdef __EMSCRIPTEN__

#include "al/protocol/al_OSC.hpp"

namespace al {
namespace osc {

// ============================================================================
// Packet Implementation (stub)
// ============================================================================

class Packet::Impl {
public:
    // No-op implementation
};

Packet::Packet(int size) : mImpl(nullptr) {
    mData.reserve(size);
}

Packet::Packet(const char* contents, size_t size) : mImpl(nullptr) {
    mData.assign(contents, contents + size);
}

Packet::~Packet() {
    delete mImpl;
}

const char* Packet::data() const {
    return mData.data();
}

bool Packet::isMessage() const {
    return !mData.empty();
}

bool Packet::isBundle() const {
    return false;
}

void Packet::printRaw() const {
    // No-op
}

size_t Packet::size() const {
    return mData.size();
}

Packet& Packet::beginBundle(TimeTag) {
    return *this;
}

Packet& Packet::endBundle() {
    return *this;
}

Packet& Packet::beginMessage(const std::string&) {
    return *this;
}

Packet& Packet::endMessage() {
    return *this;
}

Packet& Packet::operator<<(int) {
    return *this;
}

Packet& Packet::operator<<(unsigned) {
    return *this;
}

Packet& Packet::operator<<(int64_t) {
    return *this;
}

Packet& Packet::operator<<(uint64_t) {
    return *this;
}

Packet& Packet::operator<<(float) {
    return *this;
}

Packet& Packet::operator<<(double) {
    return *this;
}

Packet& Packet::operator<<(char) {
    return *this;
}

Packet& Packet::operator<<(const char*) {
    return *this;
}

Packet& Packet::operator<<(const std::string&) {
    return *this;
}

Packet& Packet::operator<<(const Blob&) {
    return *this;
}

Packet& Packet::clear() {
    mData.clear();
    return *this;
}

// ============================================================================
// Message Implementation (stub)
// ============================================================================

class Message::Impl {
public:
    // No-op implementation
};

Message::Message(const char*, int, const TimeTag& timeTag,
                 const char* senderAddr, uint16_t senderPort)
    : mImpl(nullptr), mTimeTag(timeTag), mSenderPort(senderPort) {
    if (senderAddr) {
        strncpy(mSenderAddr, senderAddr, sizeof(mSenderAddr) - 1);
        mSenderAddr[sizeof(mSenderAddr) - 1] = '\0';
    } else {
        mSenderAddr[0] = '\0';
    }
}

Message::~Message() {
    delete mImpl;
}

void Message::print() const {
    // No-op
}

Message& Message::resetStream() {
    return *this;
}

Message& Message::operator>>(int&) {
    return *this;
}

Message& Message::operator>>(float&) {
    return *this;
}

Message& Message::operator>>(double&) {
    return *this;
}

Message& Message::operator>>(char&) {
    return *this;
}

Message& Message::operator>>(const char*&) {
    return *this;
}

Message& Message::operator>>(std::string&) {
    return *this;
}

Message& Message::operator>>(Blob&) {
    return *this;
}

// ============================================================================
// Send Implementation (stub)
// ============================================================================

class Send::SocketSender {
public:
    // No-op implementation
};

Send::Send() : Packet(1024), socketSender(nullptr) {}

Send::Send(int size) : Packet(size), socketSender(nullptr) {}

Send::Send(uint16_t port, const char* address, al_sec, int size)
    : Packet(size), socketSender(nullptr), mAddress(address ? address : ""), mPort(port) {}

Send::~Send() = default;

bool Send::open(uint16_t port, const char* address) {
    mPort = port;
    mAddress = address ? address : "";
    return true; // Stub: always succeeds
}

size_t Send::send() {
    clear();
    return 0; // No actual send in web environment
}

size_t Send::send(const Packet&) {
    return 0; // No actual send in web environment
}

} // namespace osc
} // namespace al

#endif // __EMSCRIPTEN__
