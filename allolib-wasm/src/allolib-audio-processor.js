/**
 * AlloLib Audio Worklet Processor
 *
 * This AudioWorklet processor handles real-time audio processing
 * for AlloLib applications running in the browser.
 *
 * Communication with the main thread:
 * - Sends 'requestBuffer' messages to request audio data from WASM
 * - Receives 'audioBuffer' messages with processed audio data
 * - Receives 'setListener' messages for spatial audio positioning
 */

class AllolibProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        // Configuration from options
        const processorOptions = options.processorOptions || {};
        this.bufferSize = processorOptions.bufferSize || 128;
        this.sampleRate = processorOptions.sampleRate || 44100;
        this.outputChannels = processorOptions.outputChannels || 2;

        // Audio buffer queue
        this.pendingBuffer = null;
        this.bufferQueue = [];
        this.maxQueueSize = 4; // Keep a few buffers ahead

        // Listener state for spatial audio
        this.listenerPos = { x: 0, y: 0, z: 0 };
        this.listenerQuat = { w: 1, x: 0, y: 0, z: 0 };

        // Handle messages from main thread
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        // Request initial buffer
        this.requestBuffer();
    }

    handleMessage(data) {
        switch (data.type) {
            case 'audioBuffer':
                // Received audio buffer from WASM
                if (data.buffer) {
                    this.bufferQueue.push(new Float32Array(data.buffer));
                    // Keep queue size reasonable
                    while (this.bufferQueue.length > this.maxQueueSize) {
                        this.bufferQueue.shift();
                    }
                }
                break;

            case 'setListener':
                // Update listener position for spatial audio
                if (data.pos) {
                    this.listenerPos = data.pos;
                }
                if (data.quat) {
                    this.listenerQuat = data.quat;
                }
                break;

            case 'configure':
                // Reconfigure audio settings
                if (data.bufferSize) this.bufferSize = data.bufferSize;
                if (data.sampleRate) this.sampleRate = data.sampleRate;
                if (data.outputChannels) this.outputChannels = data.outputChannels;
                break;
        }
    }

    requestBuffer() {
        // Request new buffer from main thread (which calls into WASM)
        this.port.postMessage({
            type: 'requestBuffer',
            frames: this.bufferSize,
            channels: this.outputChannels
        });
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];

        if (!output || output.length === 0) {
            return true;
        }

        const numChannels = output.length;
        const numFrames = output[0].length;

        // Get buffer from queue
        let buffer = this.bufferQueue.shift();

        if (buffer) {
            // Copy buffer to output channels
            for (let channel = 0; channel < numChannels; channel++) {
                const outputChannel = output[channel];
                for (let i = 0; i < numFrames; i++) {
                    // Buffer is interleaved: [L0, R0, L1, R1, ...]
                    const bufferIndex = i * numChannels + channel;
                    if (bufferIndex < buffer.length) {
                        outputChannel[i] = buffer[bufferIndex];
                    } else {
                        outputChannel[i] = 0;
                    }
                }
            }
        } else {
            // No buffer available, output silence
            for (let channel = 0; channel < numChannels; channel++) {
                output[channel].fill(0);
            }
        }

        // Request more buffers if queue is getting low
        if (this.bufferQueue.length < 2) {
            this.requestBuffer();
        }

        return true;
    }
}

// Register the processor
registerProcessor('allolib-processor', AllolibProcessor);
