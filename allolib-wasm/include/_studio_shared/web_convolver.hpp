#pragma once

/**
 * AlloLib Studio Online - WebConvolver
 *
 * Real partitioned-FFT convolution. Substitutes for
 * `al_ext/spatialaudio/al_Convolver.hpp` (zita-convolver), which is not
 * linked into libal_web.a.
 *
 * Algorithm: uniformly-partitioned overlap-save with frequency-domain
 * accumulation (the JUCE `dsp::Convolution` / Wikipedia "Overlap-save method"
 * shape). The IR is split into K = ceil(irLen / blockSize) partitions, each
 * of length P = blockSize, zero-padded to N = 2*P, FFT'd, and stored as a
 * flat array of K*N real-valued slots holding interleaved RFFT spectra.
 * Each audio block:
 *   1. Append the new P-sample input chunk to a length-N rolling input
 *      window (last block + this block); FFT into a fresh spectrum slot in a
 *      ring buffer of K spectra (indexed by mFifoHead).
 *   2. For each partition k = 0..K-1: complex-multiply the partition's
 *      spectrum by the input spectrum at ring position
 *      (mFifoHead - k + K) % K, and accumulate (add) into a length-N
 *      frequency-domain accumulator.
 *   3. IFFT the accumulator; output the second half (samples [P..2P-1]) as
 *      the next block of audio (overlap-save discards the first half).
 *
 * Complex spectra are stored in Gamma's RFFT<float> "complexBuf=true" layout:
 * N/2 + 1 complex bins packed as 2*(N/2+1) = N+2 real samples
 * [re0, im0, re1, im1, ..., re_{N/2}, im_{N/2}], where bin 0 (DC) and
 * bin N/2 (Nyquist) have zero imaginary parts.
 *
 * Performance: O(N log N) per block, dominated by 2 forward + 1 inverse
 * RFFT plus K complex-multiply-accumulates. For a typical 1-second IR at
 * 48 kHz with blockSize=128, K = ceil(48000/128) = 375 partitions; that's
 * ~750 forward FFTs of length 256 per second of audio (one input FFT per
 * block, and K complex MACs reused across all blocks via the spectrum
 * ring), well under realtime budget for the AudioWorklet quantum.
 *
 * Non-uniform partitioning (an early small block + a tail of larger
 * partitions, JUCE-style) is intentionally NOT implemented: at worklet
 * blockSize=128 the uniform scheme already meets the quantum budget, and
 * non-uniform bookkeeping doubles the surface area without a measured
 * win for IR lengths typical in the MAT200B examples (rooms < 4 s).
 *
 * Thread model: WebConvolver instances are owned and processed by the
 * AudioWorklet thread. loadIR / setBlockSize / setPartitionSize must be
 * called from the same thread (e.g. inside onCreate() before audio starts,
 * or guarded by a swap pointer if the user wants live IR replacement).
 *
 * Header-only. Depends on Gamma::RFFT (linked into libal_web.a).
 */

#include "Gamma/FFT.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstring>
#include <memory>
#include <vector>

namespace al {
namespace studio {

class WebConvolver {
public:
  WebConvolver()
    : mBlockSize(128),
      mPartitionSize(128),
      mPaddedSize(256),
      mNumPartitions(0),
      mFifoHead(0),
      mIrLength(0),
      mReady(false) {}

  /// Load IR from raw float array. numSamples may be any length; partitions
  /// will tile it and the tail is zero-padded into the final partition.
  bool loadIR(const float* ir, std::size_t numSamples) {
    if (!ir || numSamples == 0) {
      clear();
      return false;
    }
    mIrLength = numSamples;
    rebuildFromCurrentSizes(ir, numSamples);
    return mReady;
  }

  bool loadIR(const std::vector<float>& ir) {
    return loadIR(ir.data(), ir.size());
  }

  /// Set audio block size (frames per process() call). Triggers rebuild if
  /// an IR is already loaded.
  void setBlockSize(std::size_t blockSize) {
    if (blockSize == 0) blockSize = 128;
    if (blockSize == mBlockSize) return;
    mBlockSize = blockSize;
    // Partition size tracks block size by default; user can override after.
    mPartitionSize = blockSize;
    if (!mIrCopy.empty()) rebuildFromCurrentSizes(mIrCopy.data(), mIrCopy.size());
  }

  /// Override partition size (must be a power of two >= blockSize).
  /// Default is blockSize. Larger partitions reduce per-block FFT count
  /// (fewer ring slots) at the cost of higher per-partition FFT length.
  void setPartitionSize(std::size_t parts) {
    if (parts == 0) parts = mBlockSize;
    // Round up to next power of two.
    std::size_t pow2 = 1;
    while (pow2 < parts) pow2 <<= 1;
    if (pow2 == mPartitionSize) return;
    mPartitionSize = pow2;
    if (!mIrCopy.empty()) rebuildFromCurrentSizes(mIrCopy.data(), mIrCopy.size());
  }

  /// Convolve `numFrames` samples from `in` into `out`. The caller may
  /// invoke this with numFrames smaller than mBlockSize; the internal
  /// scheduler buffers the input until a full partition is ready, and
  /// emits previously-computed output samples in the meantime.
  void process(const float* in, float* out, std::size_t numFrames) {
    if (!mReady || mNumPartitions == 0) {
      // Pass-through when no IR has been loaded yet.
      if (out && in && out != in) {
        std::memcpy(out, in, numFrames * sizeof(float));
      }
      return;
    }
    const std::size_t P = mPartitionSize;
    for (std::size_t i = 0; i < numFrames; ++i) {
      // mInputAccum is laid out [old_partition | new_partition]; new samples
      // fill the upper half. When the upper half is full we run the FFT
      // step and slide.
      mInputAccum[P + mInputCursor] = in[i];
      out[i] = mOutputAccum[mOutputCursor];
      ++mInputCursor;
      ++mOutputCursor;
      if (mInputCursor >= P) {
        // Full partition collected: run one overlap-save step that emits
        // the next P output samples and advances the spectrum ring.
        runPartitionStep();
        mInputCursor = 0;
        mOutputCursor = 0;
      }
    }
  }

  /// Reset internal state and free buffers.
  void clear() {
    mNumPartitions = 0;
    mIrLength = 0;
    mFifoHead = 0;
    mReady = false;
    mIrSpectra.clear();
    mInputSpectraRing.clear();
    mInputAccum.clear();
    mOutputAccum.clear();
    mScratch.clear();
    mAcc.clear();
    mInputCursor = 0;
    mOutputCursor = 0;
    mIrCopy.clear();
  }

  bool isReady() const { return mReady; }
  std::size_t irLength() const { return mIrLength; }
  std::size_t blockSize() const { return mBlockSize; }
  std::size_t partitionSize() const { return mPartitionSize; }
  std::size_t numPartitions() const { return mNumPartitions; }

private:
  // ---- Geometry --------------------------------------------------------

  std::size_t mBlockSize;        // worklet block size (typ. 128)
  std::size_t mPartitionSize;    // partition length P (default = blockSize)
  std::size_t mPaddedSize;       // FFT length N = 2*P
  std::size_t mNumPartitions;    // K = ceil(irLen / P)
  std::size_t mFifoHead;         // ring head in [0..K)
  std::size_t mIrLength;
  std::size_t mInputCursor = 0;  // 0..P  index into next input partition
  std::size_t mOutputCursor = 0; // 0..P  index into pending output buffer
  bool mReady;

  std::vector<float> mIrCopy;       // full IR (so rebuilds work after resize)

  // ---- Spectra (each spectrum has N+2 real-valued slots) ---------------

  std::vector<float> mIrSpectra;        // K * (N+2) flat: partition k @ k*(N+2)
  std::vector<float> mInputSpectraRing; // K * (N+2) ring of input spectra
  std::vector<float> mAcc;              // (N+2) frequency-domain accumulator

  // ---- Time-domain scratch / output ------------------------------------

  std::vector<float> mInputAccum;   // last 2 input partitions concatenated (N samples)
  std::vector<float> mOutputAccum;  // P samples ready to emit
  std::vector<float> mScratch;      // scratch of length N+2 for FFT roundtrip

  // ---- FFT engine ------------------------------------------------------

  std::unique_ptr<gam::RFFT<float>> mFFT;

  // ---------------------------------------------------------------------

  void rebuildFromCurrentSizes(const float* ir, std::size_t numSamples) {
    const std::size_t P = mPartitionSize;
    const std::size_t N = 2 * P;
    const std::size_t SPEC = N + 2;
    mPaddedSize = N;
    mNumPartitions = (numSamples + P - 1) / P;

    mFFT.reset(new gam::RFFT<float>(static_cast<int>(N)));

    mIrSpectra.assign(mNumPartitions * SPEC, 0.f);
    mInputSpectraRing.assign(mNumPartitions * SPEC, 0.f);
    mAcc.assign(SPEC, 0.f);
    mInputAccum.assign(N, 0.f);
    mOutputAccum.assign(P, 0.f);
    mScratch.assign(SPEC, 0.f);
    mInputCursor = 0;
    mOutputCursor = 0;
    mFifoHead = 0;

    // Cache IR copy so size changes can rebuild without re-asking the user.
    if (ir != mIrCopy.data()) {
      mIrCopy.assign(ir, ir + numSamples);
    } else if (mIrCopy.size() != numSamples) {
      mIrCopy.resize(numSamples);
    }

    // FFT each partition into mIrSpectra.
    // RFFT complexBuf=true layout: input is [*, x0, x1, ..., x(N-1), *]
    // — i.e. the N real samples sit at indices 1..N in an (N+2)-sized
    // scratch buffer. Output (in-place) is the standard interleaved
    // [r0,0,r1,i1,...,r(N/2),0] layout.
    for (std::size_t k = 0; k < mNumPartitions; ++k) {
      float* dst = mScratch.data();
      std::memset(dst, 0, SPEC * sizeof(float));
      const std::size_t kp = k * P;
      const std::size_t copy = (kp + P <= numSamples) ? P : (numSamples - kp);
      // Place P samples at offset 1; the remaining N-P slots (1+P .. N) and
      // the trailing pad slot are zero — this is standard partitioned
      // overlap-save (each IR partition is zero-padded to length N=2P).
      if (copy > 0) std::memcpy(dst + 1, ir + kp, copy * sizeof(float));
      mFFT->forward(dst, /*complexBuf=*/true, /*normalize=*/false);
      std::memcpy(&mIrSpectra[k * SPEC], dst, SPEC * sizeof(float));
    }

    mReady = true;
  }

  // Multiply partition spectrum P_k by ring spectrum X_{head-k} and add into
  // the accumulator. Spectra layout: N/2+1 complex bins as
  // [re0,im0,re1,im1,...,reN/2,imN/2] in N+2 floats. DC and Nyquist have
  // zero imag and we still write through the same complex-mul; that's
  // numerically identical because their imag is zero.
  inline void mulAddSpectrum(const float* a, const float* b, float* acc,
                             std::size_t numComplex) {
    for (std::size_t i = 0; i < numComplex; ++i) {
      const float ar = a[2 * i + 0];
      const float ai = a[2 * i + 1];
      const float br = b[2 * i + 0];
      const float bi = b[2 * i + 1];
      // (ar + i*ai) * (br + i*bi) = (ar*br - ai*bi) + i*(ar*bi + ai*br)
      acc[2 * i + 0] += ar * br - ai * bi;
      acc[2 * i + 1] += ar * bi + ai * br;
    }
  }

  // Run one overlap-save step. Pre: mInputAccum's first P samples hold the
  // previous partition's input, last P samples hold the just-collected new
  // input. Post: mOutputAccum holds the next P output samples; the input
  // ring is rotated so the new partition becomes "the previous" half.
  void runPartitionStep() {
    const std::size_t P = mPartitionSize;
    const std::size_t N = mPaddedSize;
    const std::size_t SPEC = N + 2;
    const std::size_t numComplex = (N / 2) + 1;

    // Shift input window: old new -> the next call's "old" half is what
    // we just consumed. Concretely: copy the upper half (the just-arrived
    // P samples currently sitting in mInputAccum[P..2P-1]) to the lower
    // half. The new arrivals will be written into the upper half by the
    // next batch of process() samples writing into mInputAccum[mInputCursor].
    // Because mInputAccum is laid out [old | new], we save the new chunk
    // before we overwrite it.

    // Build an FFT-input buffer of length N from mInputAccum (it already
    // has the right [old | new] contents) and FFT into the ring slot.
    // complexBuf=true expects samples at offset 1.
    {
      float* dst = mScratch.data();
      std::memset(dst, 0, SPEC * sizeof(float));
      std::memcpy(dst + 1, mInputAccum.data(), N * sizeof(float));
      mFFT->forward(dst, /*complexBuf=*/true, /*normalize=*/false);
      std::memcpy(&mInputSpectraRing[mFifoHead * SPEC], dst, SPEC * sizeof(float));
    }

    // Reset accumulator and accumulate K partitions.
    std::memset(mAcc.data(), 0, SPEC * sizeof(float));
    for (std::size_t k = 0; k < mNumPartitions; ++k) {
      // ring index: most recent input spectrum is at mFifoHead, paired
      // with partition 0; next-most-recent at (mFifoHead - 1 + K) % K
      // is paired with partition 1; etc.
      const std::size_t r = (mFifoHead + mNumPartitions - k) % mNumPartitions;
      const float* irSpec = &mIrSpectra[k * SPEC];
      const float* inSpec = &mInputSpectraRing[r * SPEC];
      mulAddSpectrum(irSpec, inSpec, mAcc.data(), numComplex);
    }

    // Inverse FFT in place. RFFT::inverse with complexBuf=true reads the
    // interleaved [r0,0,r1,i1,...,r(N/2),0] layout and writes the N real
    // samples at offsets 1..N. We discard the first P (overlap-save aliased
    // tail) and emit samples [P+1 .. 2P]. Forward+inverse with no
    // normalization multiplies by N, so divide by N.
    {
      float* buf = mScratch.data();
      std::memcpy(buf, mAcc.data(), SPEC * sizeof(float));
      mFFT->inverse(buf, /*complexBuf=*/true);
      const float norm = 1.f / static_cast<float>(N);
      for (std::size_t i = 0; i < P; ++i) {
        mOutputAccum[i] = buf[1 + P + i] * norm;
      }
    }

    // Slide the input window: next call's "old" half is what we just had
    // as "new". Move upper half down.
    std::memmove(mInputAccum.data(), mInputAccum.data() + P, P * sizeof(float));
    // Upper half will be overwritten by next P incoming samples; clear so
    // any underrun doesn't leak stale data.
    std::memset(mInputAccum.data() + P, 0, P * sizeof(float));

    // Advance the spectrum ring.
    mFifoHead = (mFifoHead + 1) % mNumPartitions;
  }
};

}  // namespace studio
}  // namespace al
