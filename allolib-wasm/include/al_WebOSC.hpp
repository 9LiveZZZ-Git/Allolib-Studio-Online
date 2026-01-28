/**
 * WebSocket-based OSC Communication
 *
 * Alternative to al_OSC.hpp for web browsers.
 * Uses WebSocket to communicate with an OSC bridge server.
 *
 * Usage:
 *   WebOSC osc;
 *   osc.connect("ws://localhost:9000");  // Connect to OSC bridge
 *
 *   // Send messages
 *   osc.send("/synth/freq", 440.0f);
 *   osc.send("/synth/amp", 0.5f);
 *
 *   // Receive messages
 *   osc.setHandler("/control/fader1", [](const OSCMessage& msg) {
 *       float value = msg.getFloat(0);
 *   });
 *
 * Note: Requires an OSC-to-WebSocket bridge server (not included).
 * Popular options: oscbridge, osc-web, node-osc-websocket
 */

#ifndef AL_WEB_OSC_HPP
#define AL_WEB_OSC_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <functional>
#include <unordered_map>
#include <cstdint>
#include <cstring>

namespace al {

/**
 * OSC argument types
 */
enum OSCType : char {
    OSC_INT32   = 'i',
    OSC_FLOAT32 = 'f',
    OSC_STRING  = 's',
    OSC_BLOB    = 'b',
    OSC_INT64   = 'h',
    OSC_DOUBLE  = 'd',
    OSC_TRUE    = 'T',
    OSC_FALSE   = 'F',
    OSC_NIL     = 'N'
};

/**
 * Single OSC argument
 */
struct OSCArg {
    OSCType type;
    union {
        int32_t i;
        float f;
        int64_t h;
        double d;
    };
    std::string s;
    std::vector<uint8_t> blob;

    OSCArg() : type(OSC_NIL), i(0) {}
    OSCArg(int32_t val) : type(OSC_INT32), i(val) {}
    OSCArg(float val) : type(OSC_FLOAT32), f(val) {}
    OSCArg(double val) : type(OSC_DOUBLE), d(val) {}
    OSCArg(const std::string& val) : type(OSC_STRING), i(0), s(val) {}
    OSCArg(bool val) : type(val ? OSC_TRUE : OSC_FALSE), i(0) {}
};

/**
 * OSC message containing address pattern and arguments
 */
class OSCMessage {
public:
    OSCMessage() {}
    OSCMessage(const std::string& addr) : mAddress(addr) {}

    const std::string& address() const { return mAddress; }
    void setAddress(const std::string& addr) { mAddress = addr; }

    size_t argCount() const { return mArgs.size(); }

    // Add arguments
    OSCMessage& add(int32_t val) { mArgs.push_back(OSCArg(val)); return *this; }
    OSCMessage& add(float val) { mArgs.push_back(OSCArg(val)); return *this; }
    OSCMessage& add(double val) { mArgs.push_back(OSCArg(val)); return *this; }
    OSCMessage& add(const std::string& val) { mArgs.push_back(OSCArg(val)); return *this; }
    OSCMessage& add(const char* val) { mArgs.push_back(OSCArg(std::string(val))); return *this; }
    OSCMessage& add(bool val) { mArgs.push_back(OSCArg(val)); return *this; }

    // Get argument type
    OSCType getType(int index) const {
        if (index < 0 || index >= (int)mArgs.size()) return OSC_NIL;
        return mArgs[index].type;
    }

    // Get arguments
    int32_t getInt(int index) const {
        if (index < 0 || index >= (int)mArgs.size()) return 0;
        const auto& arg = mArgs[index];
        if (arg.type == OSC_INT32) return arg.i;
        if (arg.type == OSC_FLOAT32) return (int32_t)arg.f;
        if (arg.type == OSC_DOUBLE) return (int32_t)arg.d;
        return 0;
    }

    float getFloat(int index) const {
        if (index < 0 || index >= (int)mArgs.size()) return 0;
        const auto& arg = mArgs[index];
        if (arg.type == OSC_FLOAT32) return arg.f;
        if (arg.type == OSC_INT32) return (float)arg.i;
        if (arg.type == OSC_DOUBLE) return (float)arg.d;
        return 0;
    }

    double getDouble(int index) const {
        if (index < 0 || index >= (int)mArgs.size()) return 0;
        const auto& arg = mArgs[index];
        if (arg.type == OSC_DOUBLE) return arg.d;
        if (arg.type == OSC_FLOAT32) return (double)arg.f;
        if (arg.type == OSC_INT32) return (double)arg.i;
        return 0;
    }

    std::string getString(int index) const {
        if (index < 0 || index >= (int)mArgs.size()) return "";
        return mArgs[index].s;
    }

    bool getBool(int index) const {
        if (index < 0 || index >= (int)mArgs.size()) return false;
        const auto& arg = mArgs[index];
        if (arg.type == OSC_TRUE) return true;
        if (arg.type == OSC_FALSE) return false;
        if (arg.type == OSC_INT32) return arg.i != 0;
        return false;
    }

    // Clear message
    void clear() {
        mAddress.clear();
        mArgs.clear();
    }

    // Serialize to JSON for WebSocket transport
    std::string toJSON() const {
        std::string json = "{\"address\":\"" + mAddress + "\",\"args\":[";
        for (size_t i = 0; i < mArgs.size(); i++) {
            if (i > 0) json += ",";
            const auto& arg = mArgs[i];
            switch (arg.type) {
                case OSC_INT32: json += std::to_string(arg.i); break;
                case OSC_FLOAT32: json += std::to_string(arg.f); break;
                case OSC_DOUBLE: json += std::to_string(arg.d); break;
                case OSC_STRING: json += "\"" + arg.s + "\""; break;
                case OSC_TRUE: json += "true"; break;
                case OSC_FALSE: json += "false"; break;
                default: json += "null"; break;
            }
        }
        json += "]}";
        return json;
    }

private:
    std::string mAddress;
    std::vector<OSCArg> mArgs;
};

/**
 * WebSocket-based OSC interface
 */
class WebOSC {
public:
    using Handler = std::function<void(const OSCMessage&)>;

    WebOSC() : mConnected(false), mReconnect(true), mReconnectDelay(2000) {}

    ~WebOSC() {
        disconnect();
    }

    /**
     * Connect to OSC bridge server via WebSocket
     * @param url WebSocket URL (e.g., "ws://localhost:9000")
     */
    void connect(const std::string& url) {
        mUrl = url;

        EM_ASM({
            var oscPtr = $0;
            var url = UTF8ToString($1);

            // Close existing connection
            if (window._alWebOSC && window._alWebOSC[oscPtr]) {
                window._alWebOSC[oscPtr].ws.close();
            }

            window._alWebOSC = window._alWebOSC || {};
            window._alWebOSC[oscPtr] = {
                ws: null,
                url: url
            };

            function createWebSocket() {
                var ws = new WebSocket(url);
                window._alWebOSC[oscPtr].ws = ws;

                ws.onopen = function() {
                    console.log('[WebOSC] Connected to', url);
                    Module.ccall('_al_web_osc_connected', null, ['number'], [oscPtr]);
                };

                ws.onclose = function() {
                    console.log('[WebOSC] Disconnected');
                    Module.ccall('_al_web_osc_disconnected', null, ['number'], [oscPtr]);

                    // Reconnect after delay
                    var state = window._alWebOSC[oscPtr];
                    if (state && state.reconnect) {
                        setTimeout(function() {
                            if (window._alWebOSC[oscPtr] && window._alWebOSC[oscPtr].reconnect) {
                                createWebSocket();
                            }
                        }, state.reconnectDelay || 2000);
                    }
                };

                ws.onerror = function(err) {
                    console.error('[WebOSC] Error:', err);
                };

                ws.onmessage = function(event) {
                    try {
                        // Parse JSON message
                        var msg = JSON.parse(event.data);
                        if (msg.address) {
                            // Convert to string for C++
                            var argsJson = JSON.stringify(msg.args || []);
                            var addressPtr = allocateUTF8(msg.address);
                            var argsPtr = allocateUTF8(argsJson);
                            Module.ccall('_al_web_osc_message', null,
                                ['number', 'number', 'number'],
                                [oscPtr, addressPtr, argsPtr]);
                            _free(addressPtr);
                            _free(argsPtr);
                        }
                    } catch (e) {
                        console.error('[WebOSC] Parse error:', e);
                    }
                };
            }

            window._alWebOSC[oscPtr].reconnect = true;
            window._alWebOSC[oscPtr].reconnectDelay = 2000;
            createWebSocket();
        }, this, url.c_str());
    }

    /**
     * Disconnect from OSC bridge
     */
    void disconnect() {
        EM_ASM({
            var oscPtr = $0;
            if (window._alWebOSC && window._alWebOSC[oscPtr]) {
                window._alWebOSC[oscPtr].reconnect = false;
                if (window._alWebOSC[oscPtr].ws) {
                    window._alWebOSC[oscPtr].ws.close();
                }
                delete window._alWebOSC[oscPtr];
            }
        }, this);
        mConnected = false;
    }

    /**
     * Check if connected
     */
    bool isConnected() const { return mConnected; }

    /**
     * Set reconnect behavior
     */
    void setReconnect(bool enable, int delayMs = 2000) {
        mReconnect = enable;
        mReconnectDelay = delayMs;

        EM_ASM({
            var oscPtr = $0;
            var reconnect = $1;
            var delay = $2;
            if (window._alWebOSC && window._alWebOSC[oscPtr]) {
                window._alWebOSC[oscPtr].reconnect = reconnect;
                window._alWebOSC[oscPtr].reconnectDelay = delay;
            }
        }, this, enable ? 1 : 0, delayMs);
    }

    /**
     * Send OSC message
     */
    void send(const OSCMessage& msg) {
        if (!mConnected) return;
        std::string json = msg.toJSON();

        EM_ASM({
            var oscPtr = $0;
            var json = UTF8ToString($1);
            if (window._alWebOSC && window._alWebOSC[oscPtr] && window._alWebOSC[oscPtr].ws) {
                var ws = window._alWebOSC[oscPtr].ws;
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(json);
                }
            }
        }, this, json.c_str());
    }

    /**
     * Send OSC message with address and single value
     */
    void send(const std::string& address, float value) {
        OSCMessage msg(address);
        msg.add(value);
        send(msg);
    }

    void send(const std::string& address, int value) {
        OSCMessage msg(address);
        msg.add(value);
        send(msg);
    }

    void send(const std::string& address, const std::string& value) {
        OSCMessage msg(address);
        msg.add(value);
        send(msg);
    }

    /**
     * Send OSC message with address and two values
     */
    void send(const std::string& address, float v1, float v2) {
        OSCMessage msg(address);
        msg.add(v1).add(v2);
        send(msg);
    }

    void send(const std::string& address, float v1, float v2, float v3) {
        OSCMessage msg(address);
        msg.add(v1).add(v2).add(v3);
        send(msg);
    }

    /**
     * Set handler for specific OSC address pattern
     */
    void setHandler(const std::string& address, Handler handler) {
        mHandlers[address] = handler;
    }

    /**
     * Set default handler for unhandled messages
     */
    void setDefaultHandler(Handler handler) {
        mDefaultHandler = handler;
    }

    /**
     * Remove handler for address
     */
    void removeHandler(const std::string& address) {
        mHandlers.erase(address);
    }

    // Internal callbacks from JavaScript
    void _onConnected() {
        mConnected = true;
        printf("[WebOSC] Connected to %s\n", mUrl.c_str());
    }

    void _onDisconnected() {
        mConnected = false;
        printf("[WebOSC] Disconnected\n");
    }

    void _onMessage(const char* address, const char* argsJson) {
        OSCMessage msg(address);

        // Parse JSON args (simple parser for basic types)
        std::string json(argsJson);
        if (json.length() > 2) {
            // Remove [ and ]
            json = json.substr(1, json.length() - 2);

            // Simple parsing (doesn't handle nested objects/strings with commas)
            size_t pos = 0;
            while (pos < json.length()) {
                // Skip whitespace
                while (pos < json.length() && (json[pos] == ' ' || json[pos] == ',')) pos++;
                if (pos >= json.length()) break;

                if (json[pos] == '"') {
                    // String
                    size_t end = json.find('"', pos + 1);
                    if (end != std::string::npos) {
                        msg.add(json.substr(pos + 1, end - pos - 1));
                        pos = end + 1;
                    } else break;
                } else if (json[pos] == 't' && json.substr(pos, 4) == "true") {
                    msg.add(true);
                    pos += 4;
                } else if (json[pos] == 'f' && json.substr(pos, 5) == "false") {
                    msg.add(false);
                    pos += 5;
                } else if (json[pos] == 'n' && json.substr(pos, 4) == "null") {
                    pos += 4;
                } else {
                    // Number
                    size_t end = pos;
                    bool hasDecimal = false;
                    while (end < json.length() && (isdigit(json[end]) || json[end] == '.' || json[end] == '-' || json[end] == 'e' || json[end] == 'E')) {
                        if (json[end] == '.') hasDecimal = true;
                        end++;
                    }
                    std::string numStr = json.substr(pos, end - pos);
                    if (hasDecimal) {
                        msg.add((float)atof(numStr.c_str()));
                    } else {
                        msg.add((int32_t)atoi(numStr.c_str()));
                    }
                    pos = end;
                }
            }
        }

        // Find handler
        auto it = mHandlers.find(address);
        if (it != mHandlers.end()) {
            it->second(msg);
        } else if (mDefaultHandler) {
            mDefaultHandler(msg);
        }
    }

private:
    bool mConnected;
    bool mReconnect;
    int mReconnectDelay;
    std::string mUrl;
    std::unordered_map<std::string, Handler> mHandlers;
    Handler mDefaultHandler;
};

} // namespace al

// C callbacks for JavaScript
extern "C" {
    void _al_web_osc_connected(al::WebOSC* osc) {
        if (osc) osc->_onConnected();
    }

    void _al_web_osc_disconnected(al::WebOSC* osc) {
        if (osc) osc->_onDisconnected();
    }

    void _al_web_osc_message(al::WebOSC* osc, const char* address, const char* argsJson) {
        if (osc) osc->_onMessage(address, argsJson);
    }
}

#endif // AL_WEB_OSC_HPP
