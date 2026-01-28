/**
 * Embedded Synth Data for AlloLib Studio Online
 *
 * Contains synthSequences and presets from the allolib_playground tutorials.
 * This data enables the web version to play demo sequences and load factory presets
 * without needing filesystem access.
 *
 * Original data from: allolib_playground/tutorials/audiovisual/bin/
 */

// =============================================================================
// Types
// =============================================================================

export interface SynthNote {
  time: number           // Start time in seconds
  duration: number       // Duration in seconds
  voice: string          // SynthVoice class name (e.g., "SineEnv", "FM")
  params: number[]       // Parameter values in order
}

export interface SynthSequence {
  name: string
  notes: SynthNote[]
  paramNames: string[]   // Parameter names in order (for reference)
}

export interface SynthPreset {
  name: string
  params: Record<string, number>
}

export interface SynthDataBundle {
  sequences: SynthSequence[]
  presets: SynthPreset[]
}

// =============================================================================
// SineEnv Data (01_SineEnv_visual)
// =============================================================================

export const sineEnvData: SynthDataBundle = {
  sequences: [
    {
      name: 'synth1',
      paramNames: ['amplitude', 'frequency', 'attackTime', 'releaseTime', 'pan'],
      notes: [
        { time: 0, duration: 0.305211, voice: 'SineEnv', params: [0.2, 27, 0.354331, 3, 0] },
        { time: 0.174683, duration: 0.218606, voice: 'SineEnv', params: [0.2, 30.3065, 0.15748, 3, 0] },
        { time: 0.28396, duration: 0.174081, voice: 'SineEnv', params: [0.2, 32.1086, 0.299213, 3, 0] },
        { time: 0.349411, duration: 0.152285, voice: 'SineEnv', params: [0.2, 36.0407, 0.346457, 3, 0] },
        { time: 0.437609, duration: 0.13083, voice: 'SineEnv', params: [0.2, 40.4543, 0.362205, 3, 0] },
        { time: 0.481445, duration: 0.129347, voice: 'SineEnv', params: [0.2, 42.8598, 0.425197, 3, 0] },
        { time: 0.546013, duration: 0.110061, voice: 'SineEnv', params: [0.2, 48.1085, 0.425197, 3, 0] },
        { time: 0.589641, duration: 0.110348, voice: 'SineEnv', params: [0.2, 54, 0.433071, 3, 0] },
        { time: 0.633376, duration: 0.110393, voice: 'SineEnv', params: [0.2, 60.613, 0.440945, 3, 0] },
        { time: 0.678589, duration: 0.109028, voice: 'SineEnv', params: [0.2, 64.2172, 0.433071, 3, 0] },
        { time: 0.720766, duration: 0.108547, voice: 'SineEnv', params: [0.2, 72.0814, 0.464567, 3, 0] },
        { time: 0.766279, duration: 0.106719, voice: 'SineEnv', params: [0.2, 80.9086, 0.417323, 3, 0] },
        { time: 0.810107, duration: 0.106558, voice: 'SineEnv', params: [0.2, 85.7197, 0.417323, 3, 0] },
        { time: 0.853974, duration: 0.10964, voice: 'SineEnv', params: [0.2, 96.2171, 0.409449, 3, 0] },
        { time: 0.89777, duration: 0.130813, voice: 'SineEnv', params: [0.2, 108, 0.393701, 3, 0] },
        { time: 0.963677, duration: 0.105874, voice: 'SineEnv', params: [0.2, 121.226, 0.377953, 3, 0] },
        { time: 1.00473, duration: 0.111436, voice: 'SineEnv', params: [0.2, 128.434, 0.393701, 3, 0] },
        { time: 1.0484, duration: 0.108525, voice: 'SineEnv', params: [0.2, 144.163, 0.433071, 3, 0] },
        { time: 1.09211, duration: 0.111777, voice: 'SineEnv', params: [0.2, 161.817, 0.433071, 3, 0] },
        { time: 1.13578, duration: 0.108541, voice: 'SineEnv', params: [0.2, 171.439, 0.464567, 3, 0] },
        { time: 1.18264, duration: 0.105344, voice: 'SineEnv', params: [0.2, 192.434, 0.472441, 3, 0] },
        { time: 1.22644, duration: 0.108759, voice: 'SineEnv', params: [0.2, 216, 0.464567, 3, 0] },
        { time: 1.27027, duration: 0.105063, voice: 'SineEnv', params: [0.2, 242.452, 0.456693, 3, 0] },
        { time: 1.31393, duration: 0.10596, voice: 'SineEnv', params: [0.2, 256.869, 0.433071, 3, 0] },
        { time: 1.35424, duration: 0.112916, voice: 'SineEnv', params: [0.2, 288.325, 0.464567, 3, 0] },
        { time: 1.42378, duration: 0.0869843, voice: 'SineEnv', params: [0.2, 323.634, 0.464567, 3, 0] },
        { time: 1.46721, duration: 0.0872265, voice: 'SineEnv', params: [0.2, 342.879, 0.456693, 3, 0] },
        { time: 1.51083, duration: 0.108059, voice: 'SineEnv', params: [0.2, 384.868, 0.472441, 3, 0] },
        { time: 1.5545, duration: 0.0838454, voice: 'SineEnv', params: [0.2, 432, 0.503937, 3, 0] },
        { time: 1.59448, duration: 0.0875239, voice: 'SineEnv', params: [0.2, 484.904, 0.496063, 3, 0] },
        { time: 1.64187, duration: 0.104832, voice: 'SineEnv', params: [0.2, 513.737, 0.496063, 3, 0] },
        { time: 1.68524, duration: 0.105092, voice: 'SineEnv', params: [0.2, 576.651, 0.535433, 3, 0] },
        { time: 1.72554, duration: 0.109405, voice: 'SineEnv', params: [0.2, 647.269, 0.503937, 3, 0] },
        { time: 1.77225, duration: 0.127286, voice: 'SineEnv', params: [0.2, 685.757, 0.503937, 3, 0] },
        { time: 1.838, duration: 0.127041, voice: 'SineEnv', params: [0.2, 769.736, 0.472441, 3, 0] },
        { time: 1.88127, duration: 0.128425, voice: 'SineEnv', params: [0.2, 864, 0.448819, 3, 0] },
        { time: 1.94396, duration: 0.130313, voice: 'SineEnv', params: [0.2, 969.807, 0.448819, 3, 0] },
        { time: 2.01246, duration: 0.129745, voice: 'SineEnv', params: [0.2, 1027.47, 0.433071, 3, 0] },
        { time: 2.05557, duration: 0.131205, voice: 'SineEnv', params: [0.2, 1153.3, 0.480315, 3, 0] },
        { time: 2.11873, duration: 0.132418, voice: 'SineEnv', params: [0.2, 1294.54, 0.464567, 3, 0] },
        { time: 2.18684, duration: 0.10881, voice: 'SineEnv', params: [0.2, 1371.51, 0.480315, 3, 0] },
        { time: 2.22799, duration: 0.109268, voice: 'SineEnv', params: [0.2, 1539.47, 0.488189, 3, 0] },
        { time: 2.29571, duration: 0.108339, voice: 'SineEnv', params: [0.2, 1728, 0.480315, 3, 0] },
        { time: 2.33952, duration: 0.107058, voice: 'SineEnv', params: [0.2, 1939.61, 0.480315, 3, 0] },
        { time: 2.38277, duration: 0.107424, voice: 'SineEnv', params: [0.2, 2054.95, 0.488189, 3, 0] },
        { time: 2.44876, duration: 0.0851205, voice: 'SineEnv', params: [0.2, 2306.6, 0.535433, 3, 0] },
        { time: 2.49243, duration: 0.0872349, voice: 'SineEnv', params: [0.2, 2589.07, 0.543307, 3, 0] },
        { time: 2.53627, duration: 0.0849867, voice: 'SineEnv', params: [0.2, 2743.03, 0.582677, 3, 0] },
        { time: 2.57972, duration: 0.108999, voice: 'SineEnv', params: [0.2, 3078.95, 0.598425, 3, 0] },
        { time: 2.6235, duration: 0.108057, voice: 'SineEnv', params: [0.2, 3456, 0.582677, 3, 0] },
        { time: 2.6888, duration: 0.130086, voice: 'SineEnv', params: [0.2, 3879.23, 0.543307, 3, 0] },
        { time: 2.75411, duration: 0.108321, voice: 'SineEnv', params: [0.2, 4109.9, 0.503937, 3, 0] },
        // Descending section
        { time: 4.12815, duration: 0.195866, voice: 'SineEnv', params: [0.2, 3661.5, 0.409449, 3, 0] },
        { time: 4.25923, duration: 0.152115, voice: 'SineEnv', params: [0.2, 3262.03, 0.425197, 3, 0] },
        { time: 4.34661, duration: 0.132708, voice: 'SineEnv', params: [0.2, 2906.14, 0.535433, 3, 0] },
        { time: 4.43629, duration: 0.106246, voice: 'SineEnv', params: [0.2, 2443.76, 0.779528, 3, 0] },
        { time: 4.52135, duration: 0.0866168, voice: 'SineEnv', params: [0.2, 2177.14, 0.535433, 3, 0] },
        { time: 4.58946, duration: 0.105836, voice: 'SineEnv', params: [0.2, 1830.75, 0.818898, 3, 0] },
        { time: 4.65508, duration: 0.0839182, voice: 'SineEnv', params: [0.2, 1631.01, 0.511811, 3, 0] },
        { time: 4.71787, duration: 0.086771, voice: 'SineEnv', params: [0.2, 1453.07, 0.574803, 3, 0] },
        { time: 4.7646, duration: 0.108749, voice: 'SineEnv', params: [0.2, 1221.88, 0.787402, 3, 0] },
        { time: 4.82711, duration: 0.0866308, voice: 'SineEnv', params: [0.2, 1088.57, 0.551181, 3, 0] },
        { time: 4.89261, duration: 0.0866588, voice: 'SineEnv', params: [0.2, 915.376, 0.80315, 3, 0] },
        { time: 4.96153, duration: 0.0651238, voice: 'SineEnv', params: [0.2, 815.507, 0.456693, 3, 0] },
        { time: 5.00183, duration: 0.065921, voice: 'SineEnv', params: [0.2, 726.534, 0.496063, 3, 0] },
        { time: 5.0493, duration: 0.0868499, voice: 'SineEnv', params: [0.2, 610.94, 0.787402, 3, 0] },
        { time: 5.09307, duration: 0.104603, voice: 'SineEnv', params: [0.2, 544.286, 0.456693, 3, 0] },
        { time: 5.15878, duration: 0.108741, voice: 'SineEnv', params: [0.2, 457.688, 0.748031, 3, 0] },
        { time: 5.22033, duration: 0.091012, voice: 'SineEnv', params: [0.2, 407.754, 0.409449, 3, 0] },
        { time: 5.29009, duration: 0.0867284, voice: 'SineEnv', params: [0.2, 363.267, 0.425197, 3, 0] },
        { time: 5.35129, duration: 0.112778, voice: 'SineEnv', params: [0.2, 305.47, 0.740157, 3, 0] },
        { time: 5.41685, duration: 0.0866155, voice: 'SineEnv', params: [0.2, 272.143, 0.456693, 3, 0] },
        { time: 5.48236, duration: 0.108442, voice: 'SineEnv', params: [0.2, 228.844, 0.748031, 3, 0] },
        { time: 5.55231, duration: 0.104062, voice: 'SineEnv', params: [0.2, 203.877, 0.448819, 3, 0] },
        { time: 5.6177, duration: 0.104233, voice: 'SineEnv', params: [0.2, 181.634, 0.456693, 3, 0] },
        { time: 5.67893, duration: 0.130326, voice: 'SineEnv', params: [0.2, 152.735, 0.76378, 3, 0] },
        { time: 5.76627, duration: 0.108458, voice: 'SineEnv', params: [0.2, 136.071, 0.425197, 3, 0] },
        { time: 5.83608, duration: 0.131171, voice: 'SineEnv', params: [0.2, 114.422, 0.740157, 3, 0] },
        { time: 5.91917, duration: 0.108514, voice: 'SineEnv', params: [0.2, 101.938, 0.440945, 3, 0] },
        { time: 5.96719, duration: 0.126022, voice: 'SineEnv', params: [0.2, 90.8168, 0.456693, 3, 0] },
        { time: 6.0502, duration: 0.130449, voice: 'SineEnv', params: [0.2, 76.3675, 0.748031, 3, 0] },
        { time: 6.12004, duration: 0.126022, voice: 'SineEnv', params: [0.2, 68.0357, 0.456693, 3, 0] },
        { time: 6.20313, duration: 0.157396, voice: 'SineEnv', params: [0.2, 57.211, 0.685039, 3, 0] },
        { time: 6.29048, duration: 0.135771, voice: 'SineEnv', params: [0.2, 50.9692, 0.488189, 3, 0] },
        { time: 6.36045, duration: 0.217589, voice: 'SineEnv', params: [0.2, 45.4084, 0.425197, 3, 0] },
        { time: 6.42167, duration: 0.304951, voice: 'SineEnv', params: [0.2, 38.1838, 0.661417, 3, 0] },
        { time: 6.59623, duration: 0.326973, voice: 'SineEnv', params: [0.2, 34.0179, 0.425197, 3, 0] },
        { time: 6.75327, duration: 0.217621, voice: 'SineEnv', params: [0.2, 28.6055, 0.480315, 3, 0] },
      ],
    },
  ],
  presets: [],
}

// =============================================================================
// FM Vibrato Data (04_FMVib_visual) - synth4Vib
// =============================================================================

export const fmVibData: SynthDataBundle = {
  sequences: [
    {
      name: 'synth4',
      paramNames: ['freq', 'amplitude', 'attackTime', 'releaseTime', 'sustain', 'idx1', 'idx2', 'idx3', 'carMul', 'modMul', 'pan'],
      notes: [
        { time: 0, duration: 5, voice: 'FM', params: [262, 0.5, 0.1, 0.1, 0.75, 0.01, 7, 5, 1, 1.0007, 1] },
        { time: 5, duration: 5, voice: 'FM', params: [220, 0.5, 0.1, 0.1, 0.75, 0.01, 7, 5, 1, 1.0007, 0] },
        { time: 10, duration: 5, voice: 'FM', params: [262, 0.5, 0.1, 0.1, 0.75, 0.01, 4, 4, 3, 2.0007, -1] },
        { time: 15, duration: 5, voice: 'FM', params: [262, 0.5, 0.2, 0.1, 0.75, 2.00, 2, 2, 3, 1.0007, 0] },
        { time: 20, duration: 5, voice: 'FM', params: [139, 0.5, 0.2, 0.1, 0.75, 0.01, 1.5, 1.5, 5, 1.0007, 0] },
        { time: 25, duration: 0.1, voice: 'FM', params: [100, 0.5, 0.001, 9.90, 0.8, 7.0, 7.0, 7.0, 1, 1.4, 0] },
        { time: 30, duration: 0.05, voice: 'FM', params: [100, 0.5, 0.001, 0.25, 0.8, 5, 5, 5, 1, 1.48, 0] },
      ],
    },
    {
      name: 'synth4_vib',
      paramNames: ['freq', 'amplitude', 'attackTime', 'releaseTime', 'sustain', 'idx1', 'idx2', 'idx3', 'carMul', 'modMul', 'vibRate1', 'vibRate2', 'vibRise', 'vibDepth', 'pan'],
      notes: [
        { time: 0, duration: 5, voice: 'FM', params: [262, 0.5, 0.1, 0.1, 0.75, 0.01, 7, 5, 1, 1.0007, 7.5, 7.5, 0.5, 0.05, 1] },
        { time: 5, duration: 5, voice: 'FM', params: [220, 0.5, 0.1, 0.1, 0.75, 0.01, 7, 5, 1, 1.0007, 3.5, 10.08, 0.5, 0.03, 0] },
        { time: 10, duration: 5, voice: 'FM', params: [262, 0.5, 0.1, 0.1, 0.75, 0.01, 4, 4, 3, 2.0007, 9.8, 3.5, 0.5, 0.003, 0] },
        { time: 15, duration: 5, voice: 'FM', params: [262, 0.5, 0.2, 0.1, 0.75, 2, 2, 2, 3, 1.0007, 3.5, 15, 1, 0.005, 0] },
        { time: 20, duration: 5, voice: 'FM', params: [139, 0.5, 0.2, 0.1, 0.75, 0.01, 1.5, 1.5, 5, 1.0007, 3.5, 7.0, 0, 0.003, 0] },
        { time: 25, duration: 0.1, voice: 'FM', params: [100, 0.5, 0.001, 7, 0.8, 7, 3, 1, 1, 1.4, 0, 0, 0.5, 3.03, 0] },
        { time: 30, duration: 0.05, voice: 'FM', params: [100, 0.5, 0.001, 0.25, 0.8, 5, 5, 5, 1, 1.48, 3.5, 7.0, 0.5, 0.03, 0] },
      ],
    },
  ],
  presets: [
    { name: 'brass', params: { amplitude: 0.5, attackTime: 0.1, carMul: 1, freq: 384.868225, idx1: 0.01, idx2: 7, idx3: 5, modMul: 1.0007, pan: 0, releaseTime: 0.1, sustain: 0.75, vibDepth: 0, vibRate1: 0, vibRate2: 0, vibRise: 0 } },
    { name: 'clarinet', params: { amplitude: 0.5, attackTime: 0.1, carMul: 1, freq: 384.868225, idx1: 0.01, idx2: 7, idx3: 5, modMul: 1.0007, pan: 0, releaseTime: 0.1, sustain: 0.75, vibDepth: 0, vibRate1: 0, vibRate2: 0, vibRise: 0 } },
    { name: 'oboe', params: { amplitude: 0.5, attackTime: 0.2, carMul: 3, freq: 262, idx1: 2, idx2: 2, idx3: 2, modMul: 1.0007, pan: 0, releaseTime: 0.1, sustain: 0.75, vibDepth: 0.005, vibRate1: 3.5, vibRate2: 15, vibRise: 1 } },
    { name: 'basoon', params: { amplitude: 0.5, attackTime: 0.2, carMul: 5, freq: 139, idx1: 0.01, idx2: 1.5, idx3: 1.5, modMul: 1.0007, pan: 0, releaseTime: 0.1, sustain: 0.75, vibDepth: 0.003, vibRate1: 3.5, vibRate2: 7, vibRise: 0 } },
    { name: 'gong', params: { amplitude: 0.5, attackTime: 0.001, carMul: 1, freq: 100, idx1: 7, idx2: 3, idx3: 1, modMul: 1.4, pan: 0, releaseTime: 7, sustain: 0.8, vibDepth: 0, vibRate1: 0, vibRate2: 0, vibRise: 0.5 } },
    { name: 'drum', params: { amplitude: 0.5, attackTime: 0.001, carMul: 1, freq: 100, idx1: 5, idx2: 5, idx3: 5, modMul: 1.48, pan: 0, releaseTime: 0.25, sustain: 0.8, vibDepth: 0.03, vibRate1: 3.5, vibRate2: 7, vibRise: 0.5 } },
  ],
}

// =============================================================================
// Additive Synthesis Data (07_AddSyn_visual) - synth7
// =============================================================================

export const addSynData: SynthDataBundle = {
  sequences: [
    {
      name: 'synth7',
      paramNames: ['amp', 'frequency', 'ampStri', 'attackStri', 'releaseStri', 'sustainStri', 'ampLow', 'attackLow', 'releaseLow', 'sustainLow', 'ampUp', 'attackUp', 'releaseUp', 'sustainUp', 'freqStri1', 'freqStri2', 'freqStri3', 'freqLow1', 'freqLow2', 'freqUp1', 'freqUp2', 'freqUp3', 'freqUp4', 'pan'],
      notes: [
        { time: 0, duration: 0.2, voice: 'AddSyn', params: [0.1, 155.6, 0.5, 0.0001, 3.8, 0.3, 0.4, 0.0001, 6.0, 0.99, 0.3, 0.0001, 6.0, 0.9, 2, 3, 4.07, 0.56, 0.92, 1.19, 1.7, 2.75, 3.36, 0.0] },
        { time: 7, duration: 0.2, voice: 'AddSyn', params: [0.1, 622.2, 0.5, 0.0001, 6.1, 0.99, 0.4, 0.0005, 6.1, 0.99, 0.3, 0.0005, 6.1, 0.9, 2, 3, 4.07, 0.56, 0.92, 1.19, 1.7, 2.75, 3.36, 0.0] },
        { time: 14, duration: 6.1, voice: 'AddSyn', params: [0.01, 155.6, 0.5, 0.1, 0.1, 0.8, 0.5, 0.001, 0.1, 0.8, 0.6, 0.01, 0.075, 0.9, 1, 2.001, 3, 4.00009, 5.0002, 6, 7, 8, 9, 0.0] },
        { time: 21, duration: 5.8, voice: 'AddSyn', params: [0.01, 77.78, 0.5, 0.1, 0.4, 0.8, 0.5, 0.001, 0.4, 0.8, 0.6, 0.01, 0.4, 0.5, 1, 2.0001, 3, 4.00009, 5.0002, 6, 7, 8, 9, 0.0] },
        { time: 28, duration: 5.8, voice: 'AddSyn', params: [0.01, 311.1, 0.5, 0.1, 0.4, 0.8, 0.5, 0.001, 0.4, 0.8, 0.6, 0.01, 0.4, 0.5, 1, 1.0001, 3, 3.0009, 5.0002, 5, 7, 7.0009, 9, 0.0] },
        { time: 35, duration: 0.1, voice: 'AddSyn', params: [0.01, 1245, 0.5, 0.0001, 6.1, 0.99, 0.4, 0.0005, 6.1, 0.99, 0.3, 0.0005, 6.1, 0.9, 1, 3, 4.07, 0.56, 0.92, 1.19, 1.7, 2.74, 3.36, 0.0] },
      ],
    },
  ],
  presets: [],
}

// =============================================================================
// Subtractive Synthesis Data (08_SubSyn_visual) - synth8
// =============================================================================

export const subSynData: SynthDataBundle = {
  sequences: [
    {
      name: 'synth8',
      paramNames: ['amplitude', 'frequency', 'attackTime', 'releaseTime', 'sustain', 'curve', 'noise', 'envDur', 'cf1', 'cf2', 'cfRise', 'bw1', 'bw2', 'bwRise', 'hmnum', 'hmamp', 'pan'],
      notes: [
        { time: 0, duration: 5, voice: 'Sub', params: [0.3, 220, 0.1, 0.1, 0.8, 4, 0, 5, 50, 5000, 1, 20, 20, 0.5, 40, 1, -1] },
        { time: 6, duration: 5, voice: 'Sub', params: [0.3, 220, 0.1, 0.1, 0.8, 4, 0, 5, 600, 600, 1, 20, 1000, 0.5, 10, 1, 1] },
        { time: 12, duration: 5, voice: 'Sub', params: [0.8, 0, 0.1, 0.1, 0.8, 4, 1, 5, 262, 262, 1, 100, 5000, 0.5, 0, 0, 0.5] },
        { time: 18, duration: 5, voice: 'Sub', params: [0.8, 0, 0.1, 0.1, 0.8, 4, 1, 5, 100, 1000, 1, 10, 10, 1, 0, 0, -0.8] },
        { time: 24, duration: 5, voice: 'Sub', params: [0.8, 120, 1, 1, 0.8, 4, 0, 5, 50, 50, 1, 20, 2000, 0.5, 0.5, 20, 0.5] },
        { time: 30, duration: 5, voice: 'Sub', params: [0.8, 0, 1, 1, 0.8, 4, 1, 5, 100, 100, 1, 100, 5000, 0.5, 0.5, 0, 0] },
        { time: 36, duration: 5, voice: 'Sub', params: [0.8, 120, 1, 1, 0.8, 4, 0.8, 5, 100, 100, 1, 100, 5000, 0.5, 10, 1, 0] },
        { time: 41, duration: 4, voice: 'Sub', params: [0.8, 120, 1, 1, 0.8, 4, 0.8, 5, 100, 1000, 1, 20, 20, 0.5, 10, 1, 0] },
      ],
    },
  ],
  presets: [
    { name: '808', params: { amplitude: 1.0, attackTime: 0.01, bw1: 87.193, bw2: 4062.652, bwRise: 0.1, cf1: 10.0, cf2: 2651.116, cfRise: 0.157, curve: -2.53, envDur: 0.018, frequency: 42.86, hmamp: 0.555, hmnum: 7.105, noise: 0.023, pan: 0, releaseTime: 0.492, sustain: 1.0 } },
    { name: 'rhodes', params: { amplitude: 0.385, attackTime: 0.01, bw1: 4267.586, bw2: 3446.187, bwRise: 0.681, cf1: 2214.088, cf2: 1700.713, cfRise: 0.538, curve: 2.721, envDur: 0.61, frequency: 203.877, hmamp: 0.461, hmnum: 6.235, noise: 0.012, pan: 0, releaseTime: 0.1, sustain: 0.695 } },
    { name: 'crystal pad', params: { amplitude: 0.219, attackTime: 0.01, bw1: 2214.088, bw2: 1413.224, bwRise: 0.35, cf1: 2542.647, cf2: 311.18, cfRise: 0.262, curve: 4.705, envDur: 2.078, frequency: 544.286, hmamp: 1.0, hmnum: 16.934, noise: 0.346, pan: 0, releaseTime: 0.1, sustain: 0.569 } },
    { name: 'funky bass', params: { amplitude: 0.5, attackTime: 0.01, bw1: 500, bw2: 2000, bwRise: 0.2, cf1: 200, cf2: 800, cfRise: 0.15, curve: -2, envDur: 0.3, frequency: 80, hmamp: 0.8, hmnum: 8, noise: 0, pan: 0, releaseTime: 0.3, sustain: 0.7 } },
    { name: 'sine pluck', params: { amplitude: 0.4, attackTime: 0.001, bw1: 1000, bw2: 500, bwRise: 0.1, cf1: 500, cf2: 200, cfRise: 0.1, curve: -4, envDur: 0.2, frequency: 440, hmamp: 0.1, hmnum: 5, noise: 0, pan: 0, releaseTime: 0.5, sustain: 0.3 } },
  ],
}

// =============================================================================
// Integrated Multi-Voice Data (10_integrated)
// =============================================================================

export const integratedData: SynthDataBundle = {
  sequences: [
    {
      name: 'integrated',
      paramNames: [], // Variable per voice type
      notes: [
        { time: 0, duration: 4, voice: 'OscEnv', params: [0.2, 542, 0.1, 0.075, 0.7, 4, 0.2, 3] },
        { time: 5, duration: 4, voice: 'Vib', params: [0.1, 1000, 0.1, 1, 0.7, 4, 0, 2, 3.5, 5.8, 0.5, 0.005] },
        { time: 10, duration: 4, voice: 'FM', params: [262, 0.2, 0.2, 0.1, 0.75, 2, 2, 2, 3, 1.0007, 3.5, 15, 1, 0.005, 0] },
        { time: 15, duration: 4, voice: 'OscTrm', params: [0.2, 120, 0.1, 2, 0.8, 1, 0.8, 0, 4, 8, 0.5, 0.4] },
        { time: 20, duration: 4, voice: 'OscAM', params: [0.05, 262, 0.1, 0.08, 0.8, 0, 2, 0.2, 0.8, 1, 2.0001] },
        { time: 25, duration: 4, voice: 'AddSyn', params: [0.01, 311.1, 0.1, 0.1, 0.4, 0.8, 0.5, 0.001, 0.4, 0.8, 0.6, 0.01, 0.4, 0.5, 1, 1.0001, 3, 3.0009, 5.0002, 5, 7, 7.0009, 9, 0.0] },
        { time: 30, duration: 4, voice: 'Sub', params: [0.2, 120, 1, 1, 0.8, 4, 0, 4, 50, 50, 1, 20, 2000, 0.5, 0.5, 20, 0.5] },
        { time: 35, duration: 4, voice: 'PluckedString', params: [0.5, 120, 0.1, 0.0001, 1, -1, 1, 0.5] },
      ],
    },
  ],
  presets: [],
}

// =============================================================================
// Master Data Export
// =============================================================================

export const allSynthData: Record<string, SynthDataBundle> = {
  SineEnv: sineEnvData,
  synth4Vib: fmVibData,
  FM: fmVibData,
  synth7: addSynData,
  AddSyn: addSynData,
  synth8: subSynData,
  Sub: subSynData,
  Integrated: integratedData,
}

/**
 * Get sequence by synth name and sequence name
 */
export function getSequence(synthName: string, sequenceName: string): SynthSequence | undefined {
  const bundle = allSynthData[synthName]
  if (!bundle) return undefined
  return bundle.sequences.find((s) => s.name === sequenceName)
}

/**
 * Get all presets for a synth
 */
export function getPresets(synthName: string): SynthPreset[] {
  const bundle = allSynthData[synthName]
  if (!bundle) return []
  return bundle.presets
}

/**
 * Get a specific preset by name
 */
export function getPreset(synthName: string, presetName: string): SynthPreset | undefined {
  const presets = getPresets(synthName)
  return presets.find((p) => p.name === presetName)
}
