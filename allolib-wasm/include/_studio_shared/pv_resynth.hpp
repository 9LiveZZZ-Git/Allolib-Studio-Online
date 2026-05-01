#pragma once

/**
 * AlloLib Studio Online - Phase Vocoder Resynth Helper
 *
 * STFT round-trip with editable bin buffer + per-bin phase-advance
 * bookkeeping. Used by Phase Vocoder Lab and Spectrogram Painter.
 *
 * Wraps gam::STFT in MAG_PHASE mode. Phase advance is hand-rolled per bin
 * so freezeFrame() doesn't smear (analysis writes are gated; user-edited
 * phases still accumulate the expected per-hop drift).
 *
 * Header-only. No <thread> / pthread.
 *
 * Usage (audio thread):
 *
 *   PVResynth pv(2048, 512, audioIO().framesPerSecond());
 *   // per-block:
 *   pv.analyze(in, numFrames);
 *   for (int k = 0; k < pv.numBins(); ++k) {
 *     pv.setBinMag(k, pv.currentFrame()[k].magnitude * gain[k]);
 *   }
 *   pv.resynthesize(out, numFrames);
 */

#include "Gamma/DFT.h"
#include "Gamma/Types.h"  // Complex<float>

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

// v0.10.3: dropped surrounding `namespace al` to match the other helpers (file-scope ::studio)
namespace studio {

struct PVBin {
  float magnitude;
  float phase;
};

class PVResynth {
public:
  PVResynth(int fftSize = 2048, int hop = 512, float sampleRate = 48000.f)
      : mFFTSize(fftSize > 0 ? fftSize : 2048),
        mHop(hop > 0 ? hop : (mFFTSize / 4)),
        mSampleRate(sampleRate > 0.f ? sampleRate : 48000.f),
        mSTFT(static_cast<unsigned>(mFFTSize),
              static_cast<unsigned>(mHop),
              0u,
              gam::HANN,
              gam::MAG_PHASE,
              0u),
        mBins(static_cast<size_t>((mFFTSize / 2) + 1)),
        mPhaseAccum(mBins.size(), 0.0),
        mTwoPiHopOverFFT(static_cast<float>(
            2.0 * 3.14159265358979323846 * mHop / mFFTSize)) {}

  // ---- forward STFT --------------------------------------------------
  // Push numFrames input samples; whenever a frame completes, the
  // internal mBins are refreshed (unless freezeFrame is true, in which
  // case magnitudes are left alone but advance bookkeeping still runs).
  void analyze(const float* in, int numFrames) {
    if (!in || numFrames <= 0) return;
    for (int i = 0; i < numFrames; ++i) {
      if (mSTFT(in[i])) {
        // A new frame is ready in MAG_PHASE format.
        const unsigned nb = mSTFT.numBins();
        const gam::Complex<float>* src = mSTFT.bins();
        if (!mFrozen) {
          for (unsigned k = 0; k < nb && k < mBins.size(); ++k) {
            mBins[k].magnitude = src[k][0];  // mag
            mBins[k].phase     = src[k][1];  // phase
          }
        }
        // else: keep last user-visible mBins; user edits still apply.
      }
    }
  }

  // Editable bin buffer (graphics-thread side may mutate between
  // analyze/resynthesize calls).
  std::vector<PVBin>& currentFrame() { return mBins; }
  const std::vector<PVBin>& currentFrame() const { return mBins; }

  // ---- inverse STFT --------------------------------------------------
  // Pull numFrames output samples. Before pulling, the current mBins are
  // committed back into the STFT, with per-bin phase advanced by
  // 2*pi*k*hop/N (so freezing a frame does not produce a static, phasey
  // resynth -- partials still progress in time).
  void resynthesize(float* out, int numFrames) {
    if (!out || numFrames <= 0) return;
    for (int i = 0; i < numFrames; ++i) {
      // When the inverse buffer is empty, push the next frame.
      if (mSTFT.inverseOnNext()) commitFrameToSTFT();
      out[i] = mSTFT();
    }
  }

  // ---- per-bin edits -------------------------------------------------
  void setBinMag(int bin, float m) {
    if (bin < 0 || static_cast<size_t>(bin) >= mBins.size()) return;
    mBins[bin].magnitude = m;
  }

  void setBinPhase(int bin, float p) {
    if (bin < 0 || static_cast<size_t>(bin) >= mBins.size()) return;
    mBins[bin].phase = p;
  }

  // ---- freeze --------------------------------------------------------
  // When true, analyze() stops overwriting magnitudes/phases from input;
  // user-edited phases still advance per hop in resynthesize().
  void freezeFrame(bool freeze) { mFrozen = freeze; }
  bool frozen() const { return mFrozen; }

  // ---- shape ---------------------------------------------------------
  int numBins() const { return static_cast<int>(mBins.size()); }
  int fftSize() const { return mFFTSize; }
  int hopSize() const { return mHop; }
  float sampleRate() const { return mSampleRate; }

private:
  // Commit the user-visible mBins back into the STFT, advancing the
  // accumulator phase by 2*pi*k*hop/N for each bin. The bin's stored
  // phase is treated as an offset on top of the running accumulator.
  void commitFrameToSTFT() {
    const unsigned nb = mSTFT.numBins();
    gam::Complex<float>* dst = mSTFT.bins();
    constexpr double kTwoPi = 6.28318530717958647692;
    for (unsigned k = 0; k < nb && k < mBins.size(); ++k) {
      mPhaseAccum[k] += static_cast<double>(k) * mTwoPiHopOverFFT;
      // wrap into [-pi, pi]
      while (mPhaseAccum[k] >  3.14159265358979323846) mPhaseAccum[k] -= kTwoPi;
      while (mPhaseAccum[k] < -3.14159265358979323846) mPhaseAccum[k] += kTwoPi;
      const float effectivePhase =
          mBins[k].phase + static_cast<float>(mPhaseAccum[k]);
      dst[k][0] = mBins[k].magnitude;
      dst[k][1] = effectivePhase;
    }
  }

  int mFFTSize;
  int mHop;
  float mSampleRate;

  gam::STFT mSTFT;
  std::vector<PVBin> mBins;
  std::vector<double> mPhaseAccum;  // running per-bin phase advance
  float mTwoPiHopOverFFT;
  bool mFrozen{false};
};

}  // namespace studio
// (close of removed `namespace al`)
