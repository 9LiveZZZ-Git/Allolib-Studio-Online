#ifndef ALLOLIB_STUDIO_SHARED_AUDIO_FEATURES_HPP
#define ALLOLIB_STUDIO_SHARED_AUDIO_FEATURES_HPP

// MAT200B Studio Online — Audio feature extractor (header-only).
//
// Realtime feature extraction for audio→visual examples.
// Audio thread fills via processBlock(); graphics thread reads via latest().
//
// Web-specific notes:
//   - No <thread>, no pthreads. libal_web.a is single-threaded; all sync uses
//     std::atomic only (lock-free seqlock pattern, double-buffered FeatureFrame).
//   - AudioWorklet block size is fixed at 128 frames; processBlock accepts any
//     size and accumulates into the STFT's 2048-sample window with hop 512.
//   - gam::STFT is linked into libal_web.a (per plan §0.6 — Gamma DFT_FFTpack).
//
// Feature set (all real, no stubs):
//   - Block-domain: rms, peak, zcr
//   - Spectral (STFT): centroid, flatness, rolloff85, magBands[32]
//   - MFCC: 13 coefficients via 26-band mel filterbank + DCT-II
//   - Pitch: YIN algorithm (de Cheveigné & Kawahara 2002), parabolic-interp.

#include <array>
#include <atomic>
#include <cmath>
#include <cstring>
#include <utility>
#include <vector>

#include "Gamma/DFT.h"

namespace studio {

struct FeatureFrame {
  float rms = 0.f;
  float peak = 0.f;
  float zcr = 0.f;             // zero-crossing rate (0..1)
  float centroid = 0.f;        // Hz
  float flatness = 0.f;        // spectral flatness (0..1)
  float rolloff85 = 0.f;       // Hz (85% energy)
  float pitchHz = -1.f;        // -1 if unvoiced (YIN).
  std::array<float, 13> mfcc{}; // 13 MFCC coefficients (DCT-II of log mel).
  std::array<float, 32> magBands{}; // log-spaced ~mel bands for visualizers
  double timestampSec = 0.0;
};

class AudioFeatureExtractor {
 public:
  AudioFeatureExtractor(int fftSize = 2048, int hop = 512,
                        float sampleRate = 48000.f)
      : mFFTSize(fftSize),
        mHop(hop),
        mSampleRate(sampleRate),
        mStft(static_cast<unsigned>(fftSize), static_cast<unsigned>(hop), 0,
              gam::HANN, gam::MAG_FREQ),
        mNumBins(fftSize / 2),
        mEnableMFCC(false),
        mEnablePitch(false),
        mFrameCounter(0),
        mWriteIdx(0),
        mSeq(0),
        mSamplesSeen(0),
        mYinW(fftSize / 2),
        mYinBufSize(fftSize),
        mYinBuf(static_cast<size_t>(fftSize), 0.f),
        mYinDiff(static_cast<size_t>(fftSize / 2 + 1), 0.f),
        mYinCmnd(static_cast<size_t>(fftSize / 2 + 1), 1.f),
        mYinWriteIdx(0),
        mYinFilled(0),
        mLastPitchHz(-1.f),
        mLastRms(0.f) {
    mStft.spectrumType(gam::MAG_FREQ);
    // Pre-compute log-spaced band edges in [0, fftSize/2).
    const int nBands = 32;
    const float minBin = 1.f;                       // skip DC
    const float maxBin = static_cast<float>(mNumBins);
    const float ratio = std::log(maxBin / minBin) / static_cast<float>(nBands);
    for (int i = 0; i <= nBands; ++i) {
      float b = minBin * std::exp(ratio * static_cast<float>(i));
      mBandEdges[i] = b > maxBin ? maxBin : b;
    }
    buildMelFilterbank();
    buildDctMatrix();
    // Last MFCC vector held across frames so disabling doesn't zero-jump.
    mLastMfcc.fill(0.f);
  }

  // Call from onSound() with the (possibly mixed-down) input buffer.
  // numFrames may be ≤256 (transpiler clamp); inner STFT hops every 512.
  void processBlock(const float* in, int numFrames) {
    if (!in || numFrames <= 0) return;

    // Block-level RMS, peak, ZCR.
    float sumSq = 0.f;
    float pk = 0.f;
    int zc = 0;
    float prev = mPrevSample;
    for (int i = 0; i < numFrames; ++i) {
      const float s = in[i];
      sumSq += s * s;
      const float a = s < 0.f ? -s : s;
      if (a > pk) pk = a;
      if ((prev >= 0.f) != (s >= 0.f)) ++zc;
      prev = s;
    }
    mPrevSample = prev;
    const float blockRms =
        std::sqrt(sumSq / static_cast<float>(numFrames));
    const float blockZcr = static_cast<float>(zc) /
                           static_cast<float>(numFrames > 1 ? numFrames : 1);
    mLastRms = blockRms;

    // Append samples to the YIN rolling buffer (size = fftSize, ring layout).
    // YIN needs 2*W = fftSize samples to compute over a W-length window.
    for (int i = 0; i < numFrames; ++i) {
      mYinBuf[static_cast<size_t>(mYinWriteIdx)] = in[i];
      mYinWriteIdx = (mYinWriteIdx + 1) % mYinBufSize;
      if (mYinFilled < mYinBufSize) ++mYinFilled;
    }

    // Feed samples into STFT; on each completed window, compute spectral
    // features and publish a frame.
    for (int i = 0; i < numFrames; ++i) {
      if (mStft(in[i])) {
        FeatureFrame f;
        f.rms = blockRms;
        f.peak = pk;
        f.zcr = blockZcr;
        computeSpectral(f);

        // MFCC — real DCT-II of log-mel-energies. Gated by mEnableMFCC.
        if (mEnableMFCC) {
          computeMfcc(f);
          mLastMfcc = f.mfcc;
        } else {
          // Hold previous values so consumers don't see jumps when toggled off.
          f.mfcc = mLastMfcc;
        }

        // Pitch — YIN. Gated by mEnablePitch and a non-silent frame.
        if (mEnablePitch && mYinFilled >= mYinBufSize) {
          f.pitchHz = computeYin();
        } else if (mEnablePitch) {
          f.pitchHz = -1.f;  // not enough samples yet
        } else {
          f.pitchHz = mLastPitchHz;  // hold previous
        }
        mLastPitchHz = f.pitchHz;

        f.timestampSec =
            static_cast<double>(mSamplesSeen + i) / mSampleRate;
        publish(f);
        ++mFrameCounter;
      }
    }
    mSamplesSeen += numFrames;
  }

  // Lock-free read: seqlock pattern. Returns false if a write was in
  // progress and we'd see torn data; caller can retry next frame.
  bool latest(FeatureFrame& out) const {
    // Two-attempt read with sequence-counter check.
    for (int attempt = 0; attempt < 2; ++attempt) {
      const uint64_t s1 = mSeq.load(std::memory_order_acquire);
      if (s1 & 1ULL) continue;            // writer in progress
      const int idx = static_cast<int>((s1 >> 1) & 1ULL);
      // Copy the buffered frame.
      std::memcpy(&out, &mBuffers[idx], sizeof(FeatureFrame));
      const uint64_t s2 = mSeq.load(std::memory_order_acquire);
      if (s1 == s2) return true;
    }
    return false;
  }

  void setSampleRate(float sr) {
    mSampleRate = sr;
    // Mel filterbank depends on sample rate; rebuild.
    buildMelFilterbank();
    // DCT matrix is sample-rate independent (only depends on M, C).
  }

  // Toggle expensive features. When OFF the corresponding fields hold their
  // previous values so consumers don't see a discontinuity to zero/-1.
  void enableMFCC(bool on) { mEnableMFCC = on; }
  void enablePitch(bool on) { mEnablePitch = on; }

  int fftSize() const { return mFFTSize; }
  int hopSize() const { return mHop; }

 private:
  // ---- Spectral features (centroid, flatness, rolloff85, magBands) ---------
  void computeSpectral(FeatureFrame& f) {
    // gam::STFT in MAG_FREQ mode stores magnitude in real() of each bin.
    const gam::Complex<float>* bins = mStft.bins();

    float sumMag = 0.f;
    float sumMagF = 0.f;       // for centroid: Σ k·|X[k]|
    float sumLogMag = 0.f;     // for flatness numerator
    int countNonzero = 0;
    const float binHz = mSampleRate / static_cast<float>(mFFTSize);

    // Skip bin 0 (DC) and Nyquist for stability.
    for (int k = 1; k < mNumBins; ++k) {
      const float mag = bins[k].r;
      sumMag += mag;
      sumMagF += static_cast<float>(k) * mag;
      if (mag > 1e-12f) {
        sumLogMag += std::log(mag);
        ++countNonzero;
      }
    }

    if (sumMag > 1e-12f) {
      f.centroid = (sumMagF / sumMag) * binHz;
      // Spectral flatness: geometric mean / arithmetic mean.
      const float arith = sumMag / static_cast<float>(mNumBins - 1);
      const float geom =
          countNonzero > 0
              ? std::exp(sumLogMag / static_cast<float>(countNonzero))
              : 0.f;
      f.flatness = arith > 1e-12f ? (geom / arith) : 0.f;
      if (f.flatness > 1.f) f.flatness = 1.f;

      // Rolloff85.
      const float thresh = 0.85f * sumMag;
      float cum = 0.f;
      int rk = mNumBins - 1;
      for (int k = 1; k < mNumBins; ++k) {
        cum += bins[k].r;
        if (cum >= thresh) { rk = k; break; }
      }
      f.rolloff85 = static_cast<float>(rk) * binHz;
    } else {
      f.centroid = 0.f;
      f.flatness = 0.f;
      f.rolloff85 = 0.f;
    }

    // Log-spaced 32-band magnitude summary for visualizers.
    for (int b = 0; b < 32; ++b) {
      int lo = static_cast<int>(mBandEdges[b]);
      int hi = static_cast<int>(mBandEdges[b + 1]);
      if (lo < 1) lo = 1;
      if (hi > mNumBins) hi = mNumBins;
      if (hi <= lo) hi = lo + 1;
      float acc = 0.f;
      for (int k = lo; k < hi; ++k) acc += bins[k].r;
      f.magBands[b] = acc / static_cast<float>(hi - lo);
    }
  }

  // ---- MFCC ----------------------------------------------------------------
  // 26 triangular mel filters → log-energy → DCT-II → keep first 13.
  static float hzToMel(float hz) {
    return 2595.f * std::log10(1.f + hz / 700.f);
  }
  static float melToHz(float mel) {
    return 700.f * (std::pow(10.f, mel / 2595.f) - 1.f);
  }

  void buildMelFilterbank() {
    const int M = 26;
    mMelFilters.clear();
    mMelFilters.resize(static_cast<size_t>(M));

    const float fLo = 80.f;
    const float fHi = 0.5f * mSampleRate;
    const float mLo = hzToMel(fLo);
    const float mHi = hzToMel(fHi);
    const float binHz = mSampleRate / static_cast<float>(mFFTSize);

    // M+2 mel points: [mLo, c1, c2, ..., cM, mHi]; filter m peaks at m+1.
    std::vector<float> centerHz(static_cast<size_t>(M + 2));
    for (int i = 0; i < M + 2; ++i) {
      const float mel = mLo + (mHi - mLo) * static_cast<float>(i) /
                                  static_cast<float>(M + 1);
      centerHz[static_cast<size_t>(i)] = melToHz(mel);
    }

    for (int m = 0; m < M; ++m) {
      const float fL = centerHz[static_cast<size_t>(m)];
      const float fC = centerHz[static_cast<size_t>(m + 1)];
      const float fR = centerHz[static_cast<size_t>(m + 2)];

      int kL = static_cast<int>(std::floor(fL / binHz));
      int kR = static_cast<int>(std::ceil(fR / binHz));
      if (kL < 1) kL = 1;
      if (kR > mNumBins - 1) kR = mNumBins - 1;
      if (kR < kL) kR = kL;

      std::vector<float> w(static_cast<size_t>(kR - kL + 1), 0.f);
      for (int k = kL; k <= kR; ++k) {
        const float fk = static_cast<float>(k) * binHz;
        float v = 0.f;
        if (fk >= fL && fk <= fC && fC > fL) {
          v = (fk - fL) / (fC - fL);
        } else if (fk >= fC && fk <= fR && fR > fC) {
          v = (fR - fk) / (fR - fC);
        }
        w[static_cast<size_t>(k - kL)] = v;
      }
      mMelFilters[static_cast<size_t>(m)] = std::make_pair(kL, std::move(w));
    }
  }

  void buildDctMatrix() {
    const int C = 13;
    const int M = 26;
    mDct.assign(static_cast<size_t>(C * M), 0.f);
    const float pi = 3.14159265358979323846f;
    for (int c = 0; c < C; ++c) {
      for (int m = 0; m < M; ++m) {
        mDct[static_cast<size_t>(c * M + m)] = std::cos(
            pi * static_cast<float>(c) *
            (static_cast<float>(m) + 0.5f) / static_cast<float>(M));
      }
    }
  }

  void computeMfcc(FeatureFrame& f) {
    const gam::Complex<float>* bins = mStft.bins();
    const int M = static_cast<int>(mMelFilters.size());
    const int C = 13;

    // 1) mel-filter energies + log
    float logMel[32];  // M=26, headroom of 32
    for (int m = 0; m < M; ++m) {
      const auto& filt = mMelFilters[static_cast<size_t>(m)];
      const int kStart = filt.first;
      const std::vector<float>& w = filt.second;
      float energy = 0.f;
      const int n = static_cast<int>(w.size());
      for (int i = 0; i < n; ++i) {
        const int k = kStart + i;
        if (k < 1 || k >= mNumBins) continue;
        energy += w[static_cast<size_t>(i)] * bins[k].r;
      }
      logMel[m] = std::log(energy > 1e-10f ? energy : 1e-10f);
    }

    // 2) DCT-II → 13 cepstral coeffs.
    for (int c = 0; c < C; ++c) {
      float acc = 0.f;
      for (int m = 0; m < M; ++m) {
        acc += logMel[m] * mDct[static_cast<size_t>(c * M + m)];
      }
      f.mfcc[static_cast<size_t>(c)] = acc;
    }
  }

  // ---- YIN pitch -----------------------------------------------------------
  // Returns Hz when voiced, -1.f when unvoiced.
  float computeYin() {
    // Skip on silence — YIN can latch onto noise floor.
    if (mLastRms < 1e-3f) return -1.f;

    const int W = mYinW;  // = fftSize/2 = 1024 for default config

    // Linearize the ring buffer into a flat view via index math.
    // x(j) = mYinBuf[(start + j) % bufSize], where start = mYinWriteIdx (oldest).
    const int bufSize = mYinBufSize;
    const int start = mYinWriteIdx;  // oldest sample (next slot to overwrite)
    auto X = [&](int j) -> float {
      return mYinBuf[static_cast<size_t>((start + j) % bufSize)];
    };

    // Step 1: difference function d[τ] = Σ (x[j] - x[j+τ])², j in [0,W).
    mYinDiff[0] = 0.f;
    for (int tau = 1; tau <= W; ++tau) {
      float acc = 0.f;
      for (int j = 0; j < W; ++j) {
        const float dx = X(j) - X(j + tau);
        acc += dx * dx;
      }
      mYinDiff[static_cast<size_t>(tau)] = acc;
    }

    // Step 2: cumulative mean normalized difference.
    mYinCmnd[0] = 1.f;
    float runningSum = 0.f;
    for (int tau = 1; tau <= W; ++tau) {
      runningSum += mYinDiff[static_cast<size_t>(tau)];
      const float mean = runningSum / static_cast<float>(tau);
      mYinCmnd[static_cast<size_t>(tau)] =
          mean > 1e-20f ? mYinDiff[static_cast<size_t>(tau)] / mean : 1.f;
    }

    // Step 3: absolute threshold search in valid τ range [sr/2000, sr/50].
    const float threshold = 0.10f;
    int tauMin = static_cast<int>(mSampleRate / 2000.f);
    int tauMax = static_cast<int>(mSampleRate / 50.f);
    if (tauMin < 2) tauMin = 2;
    if (tauMax > W - 1) tauMax = W - 1;

    int tauChosen = -1;
    for (int tau = tauMin; tau <= tauMax; ++tau) {
      if (mYinCmnd[static_cast<size_t>(tau)] < threshold) {
        // Find the local minimum after dropping below threshold.
        while (tau + 1 <= tauMax &&
               mYinCmnd[static_cast<size_t>(tau + 1)] <
                   mYinCmnd[static_cast<size_t>(tau)]) {
          ++tau;
        }
        tauChosen = tau;
        break;
      }
    }
    if (tauChosen < 0) return -1.f;  // unvoiced

    // Step 4: parabolic interpolation around tauChosen.
    float refinedTau = static_cast<float>(tauChosen);
    if (tauChosen > 1 && tauChosen < W) {
      const float s0 = mYinCmnd[static_cast<size_t>(tauChosen - 1)];
      const float s1 = mYinCmnd[static_cast<size_t>(tauChosen)];
      const float s2 = mYinCmnd[static_cast<size_t>(tauChosen + 1)];
      const float denom = (s0 + s2 - 2.f * s1);
      if (std::fabs(denom) > 1e-12f) {
        const float shift = 0.5f * (s0 - s2) / denom;
        // Clamp shift to ±1 sample to guard against degenerate parabolae.
        const float clamped = shift > 1.f ? 1.f : (shift < -1.f ? -1.f : shift);
        refinedTau = static_cast<float>(tauChosen) + clamped;
      }
    }
    if (refinedTau <= 0.f) return -1.f;

    return mSampleRate / refinedTau;
  }

  // ---- Seqlock publish -----------------------------------------------------
  // Encoding: bit 0 = "writer in progress" flag (1 = busy),
  //           bit 1 = which buffer holds the latest committed frame.
  //           Bits 2+ = monotonically increasing version (bumped per publish).
  // Reader (latest()) checks bit 0 == 0 and that the value is unchanged
  // across the memcpy.
  void publish(const FeatureFrame& f) {
    const uint64_t s = mSeq.load(std::memory_order_relaxed);
    const int next = 1 - mWriteIdx;
    // Mark "writer in progress" by setting bit 0.
    mSeq.store(s | 1ULL, std::memory_order_release);
    std::memcpy(&mBuffers[next], &f, sizeof(FeatureFrame));
    mWriteIdx = next;
    // Bump version by 1 in bits 2+, set bit 1 = next, clear bit 0.
    const uint64_t version = (s >> 2) + 1ULL;
    const uint64_t clean =
        (version << 2) | (static_cast<uint64_t>(next) << 1);
    mSeq.store(clean, std::memory_order_release);
  }

  int mFFTSize;
  int mHop;
  float mSampleRate;
  gam::STFT mStft;
  int mNumBins;
  bool mEnableMFCC;
  bool mEnablePitch;

  uint64_t mFrameCounter;
  float mPrevSample = 0.f;
  uint64_t mSamplesSeen;

  // Double-buffered output + seqlock.
  FeatureFrame mBuffers[2];
  int mWriteIdx;
  mutable std::atomic<uint64_t> mSeq;

  float mBandEdges[33] = {0};

  // ---- Mel filterbank + DCT (preallocated in ctor / setSampleRate) --------
  // Each entry: (startBin, weights[]) — applied as energy += w[i]*|X[start+i]|.
  std::vector<std::pair<int, std::vector<float>>> mMelFilters;
  // Row-major 13×26 DCT-II cosine matrix.
  std::vector<float> mDct;
  // Last MFCC vector — used to hold values when mEnableMFCC is toggled off.
  std::array<float, 13> mLastMfcc{};

  // ---- YIN buffers ---------------------------------------------------------
  int mYinW;          // window length = fftSize/2
  int mYinBufSize;    // ring buffer size = 2*W = fftSize
  std::vector<float> mYinBuf;     // ring buffer of recent samples
  std::vector<float> mYinDiff;    // d[τ], size W+1
  std::vector<float> mYinCmnd;    // d'[τ], size W+1
  int mYinWriteIdx;  // next slot in mYinBuf (also = oldest sample)
  int mYinFilled;    // samples written so far, capped at mYinBufSize
  float mLastPitchHz;
  float mLastRms;
};

}  // namespace studio

#endif  // ALLOLIB_STUDIO_SHARED_AUDIO_FEATURES_HPP
