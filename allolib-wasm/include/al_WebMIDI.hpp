/**
 * Web MIDI API Support
 *
 * Alternative to al_MIDI.hpp for web browsers.
 * Uses the Web MIDI API for MIDI input/output.
 *
 * Usage:
 *   WebMIDI midi;
 *   midi.open();  // Request MIDI access
 *
 *   // Set callbacks
 *   midi.setNoteOnCallback([](int ch, int note, int vel) {
 *       printf("Note ON: ch=%d note=%d vel=%d\n", ch, note, vel);
 *   });
 *
 *   // In your loop, check for messages
 *   if (midi.hasMessage()) {
 *       auto msg = midi.getMessage();
 *   }
 */

#ifndef AL_WEB_MIDI_HPP
#define AL_WEB_MIDI_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <functional>
#include <queue>
#include <cstdint>

namespace al {

/**
 * MIDI message types
 */
enum MIDIStatus : uint8_t {
    MIDI_NOTE_OFF         = 0x80,
    MIDI_NOTE_ON          = 0x90,
    MIDI_POLY_PRESSURE    = 0xA0,
    MIDI_CONTROL_CHANGE   = 0xB0,
    MIDI_PROGRAM_CHANGE   = 0xC0,
    MIDI_CHANNEL_PRESSURE = 0xD0,
    MIDI_PITCH_BEND       = 0xE0,
    MIDI_SYSTEM           = 0xF0
};

/**
 * Common MIDI control numbers
 */
enum MIDIControl : uint8_t {
    CC_MOD_WHEEL       = 1,
    CC_BREATH          = 2,
    CC_FOOT            = 4,
    CC_PORTAMENTO_TIME = 5,
    CC_DATA_MSB        = 6,
    CC_VOLUME          = 7,
    CC_BALANCE         = 8,
    CC_PAN             = 10,
    CC_EXPRESSION      = 11,
    CC_SUSTAIN         = 64,
    CC_PORTAMENTO      = 65,
    CC_SOSTENUTO       = 66,
    CC_SOFT_PEDAL      = 67,
    CC_ALL_SOUND_OFF   = 120,
    CC_ALL_NOTES_OFF   = 123
};

/**
 * MIDI message structure
 */
struct MIDIMessage {
    uint8_t status;
    uint8_t data1;
    uint8_t data2;
    double timestamp;

    int channel() const { return status & 0x0F; }
    int type() const { return status & 0xF0; }

    bool isNoteOn() const { return type() == MIDI_NOTE_ON && data2 > 0; }
    bool isNoteOff() const { return type() == MIDI_NOTE_OFF || (type() == MIDI_NOTE_ON && data2 == 0); }
    bool isCC() const { return type() == MIDI_CONTROL_CHANGE; }
    bool isPitchBend() const { return type() == MIDI_PITCH_BEND; }

    // For note messages
    int note() const { return data1; }
    int velocity() const { return data2; }

    // For CC messages
    int controller() const { return data1; }
    int value() const { return data2; }

    // For pitch bend (14-bit value, center = 8192)
    int pitchBend() const { return (data2 << 7) | data1; }
    float pitchBendNormalized() const { return (pitchBend() - 8192) / 8192.0f; }
};

/**
 * MIDI device information
 */
struct MIDIDevice {
    std::string id;
    std::string name;
    std::string manufacturer;
    bool isInput;
    bool isOutput;
};

/**
 * Web MIDI interface using Web MIDI API
 */
class WebMIDI {
public:
    // Callback types
    using NoteCallback = std::function<void(int channel, int note, int velocity)>;
    using CCCallback = std::function<void(int channel, int controller, int value)>;
    using PitchBendCallback = std::function<void(int channel, float value)>;
    using MessageCallback = std::function<void(const MIDIMessage&)>;

    WebMIDI() : mIsOpen(false), mHasSysex(false) {}

    ~WebMIDI() {
        close();
    }

    /**
     * Request MIDI access from browser
     * @param sysex Whether to request SysEx access (requires user permission)
     */
    void open(bool sysex = false) {
        if (mIsOpen) return;
        mHasSysex = sysex;

        EM_ASM({
            var midiPtr = $0;
            var sysex = $1;

            if (!navigator.requestMIDIAccess) {
                console.error('[WebMIDI] Web MIDI API not supported');
                return;
            }

            navigator.requestMIDIAccess({ sysex: sysex })
                .then(function(midiAccess) {
                    console.log('[WebMIDI] MIDI access granted');

                    // Store MIDI access globally
                    window._alWebMIDI = window._alWebMIDI || {};
                    window._alWebMIDI[midiPtr] = {
                        access: midiAccess,
                        inputs: [],
                        outputs: []
                    };

                    // List inputs
                    midiAccess.inputs.forEach(function(input) {
                        console.log('[WebMIDI] Input:', input.name);
                        window._alWebMIDI[midiPtr].inputs.push(input);

                        // Set up message handler
                        input.onmidimessage = function(event) {
                            var data = event.data;
                            Module.ccall('_al_web_midi_message', null,
                                ['number', 'number', 'number', 'number', 'number'],
                                [midiPtr, data[0], data[1] || 0, data[2] || 0, event.timeStamp]);
                        };
                    });

                    // List outputs
                    midiAccess.outputs.forEach(function(output) {
                        console.log('[WebMIDI] Output:', output.name);
                        window._alWebMIDI[midiPtr].outputs.push(output);
                    });

                    // Notify C++ that we're ready
                    Module.ccall('_al_web_midi_opened', null, ['number'], [midiPtr]);

                    // Handle device changes
                    midiAccess.onstatechange = function(event) {
                        console.log('[WebMIDI] Device change:', event.port.name, event.port.state);
                    };
                })
                .catch(function(err) {
                    console.error('[WebMIDI] Access denied:', err);
                });
        }, this, sysex ? 1 : 0);
    }

    /**
     * Close MIDI access
     */
    void close() {
        if (!mIsOpen) return;

        EM_ASM({
            var midiPtr = $0;
            if (window._alWebMIDI && window._alWebMIDI[midiPtr]) {
                // Close all input handlers
                window._alWebMIDI[midiPtr].inputs.forEach(function(input) {
                    input.onmidimessage = null;
                });
                delete window._alWebMIDI[midiPtr];
            }
        }, this);

        mIsOpen = false;
    }

    /**
     * Check if MIDI is open and ready
     */
    bool isOpen() const { return mIsOpen; }

    /**
     * Get list of available input devices
     */
    std::vector<MIDIDevice> getInputDevices() const {
        return mInputDevices;
    }

    /**
     * Get list of available output devices
     */
    std::vector<MIDIDevice> getOutputDevices() const {
        return mOutputDevices;
    }

    /**
     * Check if there are pending MIDI messages
     */
    bool hasMessage() const {
        return !mMessageQueue.empty();
    }

    /**
     * Get next MIDI message from queue
     */
    MIDIMessage getMessage() {
        if (mMessageQueue.empty()) {
            return MIDIMessage{0, 0, 0, 0};
        }
        MIDIMessage msg = mMessageQueue.front();
        mMessageQueue.pop();
        return msg;
    }

    /**
     * Set callback for note on events
     */
    void setNoteOnCallback(NoteCallback callback) {
        mNoteOnCallback = callback;
    }

    /**
     * Set callback for note off events
     */
    void setNoteOffCallback(NoteCallback callback) {
        mNoteOffCallback = callback;
    }

    /**
     * Set callback for control change events
     */
    void setCCCallback(CCCallback callback) {
        mCCCallback = callback;
    }

    /**
     * Set callback for pitch bend events
     */
    void setPitchBendCallback(PitchBendCallback callback) {
        mPitchBendCallback = callback;
    }

    /**
     * Set callback for all MIDI messages
     */
    void setMessageCallback(MessageCallback callback) {
        mMessageCallback = callback;
    }

    /**
     * Send MIDI message to first available output
     */
    void send(uint8_t status, uint8_t data1, uint8_t data2) {
        EM_ASM({
            var midiPtr = $0;
            var status = $1;
            var data1 = $2;
            var data2 = $3;

            if (window._alWebMIDI && window._alWebMIDI[midiPtr]) {
                var outputs = window._alWebMIDI[midiPtr].outputs;
                if (outputs.length > 0) {
                    outputs[0].send([status, data1, data2]);
                }
            }
        }, this, status, data1, data2);
    }

    /**
     * Send note on message
     */
    void noteOn(int channel, int note, int velocity) {
        send(MIDI_NOTE_ON | (channel & 0x0F), note & 0x7F, velocity & 0x7F);
    }

    /**
     * Send note off message
     */
    void noteOff(int channel, int note, int velocity = 0) {
        send(MIDI_NOTE_OFF | (channel & 0x0F), note & 0x7F, velocity & 0x7F);
    }

    /**
     * Send control change message
     */
    void controlChange(int channel, int controller, int value) {
        send(MIDI_CONTROL_CHANGE | (channel & 0x0F), controller & 0x7F, value & 0x7F);
    }

    /**
     * Send pitch bend message
     * @param channel MIDI channel (0-15)
     * @param value Pitch bend value (-1.0 to 1.0)
     */
    void pitchBend(int channel, float value) {
        int bendValue = (int)((value + 1.0f) * 8192.0f);
        if (bendValue < 0) bendValue = 0;
        if (bendValue > 16383) bendValue = 16383;
        send(MIDI_PITCH_BEND | (channel & 0x0F), bendValue & 0x7F, (bendValue >> 7) & 0x7F);
    }

    // Internal callback from JavaScript
    void _onMessage(uint8_t status, uint8_t data1, uint8_t data2, double timestamp) {
        MIDIMessage msg{status, data1, data2, timestamp};

        // Add to queue
        mMessageQueue.push(msg);

        // Limit queue size
        while (mMessageQueue.size() > 256) {
            mMessageQueue.pop();
        }

        // Call callbacks
        if (mMessageCallback) {
            mMessageCallback(msg);
        }

        int ch = msg.channel();
        switch (msg.type()) {
            case MIDI_NOTE_ON:
                if (data2 > 0 && mNoteOnCallback) {
                    mNoteOnCallback(ch, data1, data2);
                } else if (data2 == 0 && mNoteOffCallback) {
                    mNoteOffCallback(ch, data1, 0);
                }
                break;
            case MIDI_NOTE_OFF:
                if (mNoteOffCallback) {
                    mNoteOffCallback(ch, data1, data2);
                }
                break;
            case MIDI_CONTROL_CHANGE:
                if (mCCCallback) {
                    mCCCallback(ch, data1, data2);
                }
                break;
            case MIDI_PITCH_BEND:
                if (mPitchBendCallback) {
                    mPitchBendCallback(ch, msg.pitchBendNormalized());
                }
                break;
        }
    }

    void _onOpened() {
        mIsOpen = true;
        printf("[WebMIDI] Ready\n");
    }

private:
    bool mIsOpen;
    bool mHasSysex;
    std::vector<MIDIDevice> mInputDevices;
    std::vector<MIDIDevice> mOutputDevices;
    std::queue<MIDIMessage> mMessageQueue;

    NoteCallback mNoteOnCallback;
    NoteCallback mNoteOffCallback;
    CCCallback mCCCallback;
    PitchBendCallback mPitchBendCallback;
    MessageCallback mMessageCallback;
};

} // namespace al

// C callbacks for JavaScript
extern "C" {
    void _al_web_midi_message(al::WebMIDI* midi, int status, int data1, int data2, double timestamp) {
        if (midi) {
            midi->_onMessage(status, data1, data2, timestamp);
        }
    }

    void _al_web_midi_opened(al::WebMIDI* midi) {
        if (midi) {
            midi->_onOpened();
        }
    }
}

#endif // AL_WEB_MIDI_HPP
