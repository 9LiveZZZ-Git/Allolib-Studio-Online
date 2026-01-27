/**
 * AlloLib Audio Worklet Processor
 *
 * This AudioWorklet processor handles real-time audio processing
 * for AlloLib applications running in the browser.
 *
 * Features:
 * - Buffer queue management with underrun detection
 * - Sample-accurate scheduling via currentTime
 * - Spatial audio listener state
 * - Audio statistics reporting
 *
 * Communication with the main thread:
 * - Sends 'requestBuffer' messages to request audio data from WASM
 * - Receives 'audioBuffer' messages with processed audio data
 * - Receives 'setListener' messages for spatial audio positioning
 * - Sends 'stats' messages with audio performance metrics
 * - Sends 'underrun' messages when buffer underrun occurs
 */

class AllolibProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();

        // Configuration from options
        const processorOptions = options.processorOptions || {};
        this.bufferSize = processorOptions.bufferSize || 128;
        this.outputChannels = processorOptions.outputChannels || 2;

        // Audio buffer queue with timing
        this.bufferQueue = [];
        this.maxQueueSize = 8;  // Allow larger queue for stability
        this.minQueueSize = 2;  // Minimum buffers before requesting more

        // Sample-accurate scheduling
        this.scheduledEvents = [];  // [{time: number, event: any}]
        this.currentSample = 0;     // Global sample counter

        // Listener state for spatial audio
        this.listenerPos = { x: 0, y: 0, z: 0 };
        this.listenerQuat = { w: 1, x: 0, y: 0, z: 0 };

        // Buffer underrun detection
        this.underrunCount = 0;
        this.totalFramesProcessed = 0;
        this.lastStatsTime = currentTime;
        this.statsInterval = 1.0; // Report stats every second

        // Latency tracking
        this.bufferLatency = 0;  // Estimated latency in samples
        this.lastBufferRequestTime = 0;
        this.bufferRoundtripMs = 0;

        // Handle messages from main thread
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        // Request initial buffers
        this.requestBuffer();
        this.requestBuffer();
    }

    handleMessage(data) {
        switch (data.type) {
            case 'audioBuffer':
                // Received audio buffer from WASM
                if (data.buffer) {
                    const buffer = new Float32Array(data.buffer);
                    this.bufferQueue.push({
                        data: buffer,
                        timestamp: data.timestamp || 0,
                        scheduledTime: data.scheduledTime || null
                    });

                    // Track roundtrip time
                    if (this.lastBufferRequestTime > 0) {
                        this.bufferRoundtripMs = (currentTime - this.lastBufferRequestTime) * 1000;
                    }

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
                if (data.outputChannels) this.outputChannels = data.outputChannels;
                break;

            case 'scheduleEvent':
                // Schedule an event at a specific time
                // time is in seconds (from AudioContext.currentTime)
                if (data.time !== undefined && data.event !== undefined) {
                    this.scheduleEvent(data.time, data.event);
                }
                break;

            case 'getStats':
                // Send current stats to main thread
                this.sendStats();
                break;
        }
    }

    /**
     * Schedule an event at a specific time
     * @param {number} time - Time in seconds (AudioContext.currentTime)
     * @param {any} event - Event data to trigger
     */
    scheduleEvent(time, event) {
        // Insert in sorted order
        let i = 0;
        while (i < this.scheduledEvents.length && this.scheduledEvents[i].time < time) {
            i++;
        }
        this.scheduledEvents.splice(i, 0, { time, event });
    }

    /**
     * Process any scheduled events for the current time window
     * @param {number} startTime - Start time of current buffer
     * @param {number} endTime - End time of current buffer
     */
    processScheduledEvents(startTime, endTime) {
        const triggeredEvents = [];

        while (this.scheduledEvents.length > 0 && this.scheduledEvents[0].time < endTime) {
            const scheduled = this.scheduledEvents.shift();
            if (scheduled.time >= startTime) {
                // Calculate sample offset within this buffer
                const sampleOffset = Math.floor((scheduled.time - startTime) * sampleRate);
                triggeredEvents.push({
                    event: scheduled.event,
                    sampleOffset: Math.max(0, sampleOffset)
                });
            }
        }

        // Notify main thread of triggered events
        if (triggeredEvents.length > 0) {
            this.port.postMessage({
                type: 'scheduledEvents',
                events: triggeredEvents
            });
        }
    }

    requestBuffer() {
        this.lastBufferRequestTime = currentTime;

        // Request new buffer from main thread (which calls into WASM)
        this.port.postMessage({
            type: 'requestBuffer',
            frames: this.bufferSize,
            channels: this.outputChannels,
            currentTime: currentTime,
            currentSample: this.currentSample,
            queueLength: this.bufferQueue.length
        });
    }

    sendStats() {
        this.port.postMessage({
            type: 'stats',
            queueLength: this.bufferQueue.length,
            underrunCount: this.underrunCount,
            totalFramesProcessed: this.totalFramesProcessed,
            bufferRoundtripMs: this.bufferRoundtripMs,
            currentTime: currentTime,
            currentSample: this.currentSample
        });
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];

        if (!output || output.length === 0) {
            return true;
        }

        const numChannels = output.length;
        const numFrames = output[0].length;
        const bufferDuration = numFrames / sampleRate;

        // Process scheduled events for this time window
        this.processScheduledEvents(currentTime, currentTime + bufferDuration);

        // Get buffer from queue
        let bufferEntry = this.bufferQueue.shift();

        if (bufferEntry && bufferEntry.data) {
            const buffer = bufferEntry.data;

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
            // No buffer available - UNDERRUN
            this.underrunCount++;

            // Output silence
            for (let channel = 0; channel < numChannels; channel++) {
                output[channel].fill(0);
            }

            // Notify main thread of underrun
            this.port.postMessage({
                type: 'underrun',
                count: this.underrunCount,
                queueLength: this.bufferQueue.length,
                currentTime: currentTime
            });
        }

        // Update counters
        this.totalFramesProcessed += numFrames;
        this.currentSample += numFrames;

        // Request more buffers if queue is getting low
        if (this.bufferQueue.length < this.minQueueSize) {
            this.requestBuffer();
        }

        // Periodic stats reporting
        if (currentTime - this.lastStatsTime >= this.statsInterval) {
            this.sendStats();
            this.lastStatsTime = currentTime;
        }

        return true;
    }
}

// Register the processor
registerProcessor('allolib-processor', AllolibProcessor);
