#pragma once

/**
 * AlloLib Studio Online - Pixel Audio Bridge
 *
 * Shared byte buffer + atomic row index for audio-rate pixel reads.
 * Used by McLaren Synchromy (audio samples come from pixels) and
 * Lissajous draw mode.
 *
 * Threading model: the AudioWorklet thread and the main (graphics) thread
 * share the same WASM linear memory under SharedArrayBuffer-disabled
 * builds. Mutation happens only on the graphics thread; the audio thread
 * reads via readRow() which copies into a caller-owned buffer (no
 * allocation in the audio path -- the caller pre-sizes dst).
 *
 * Header-only. No <thread> / pthread.
 */

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

namespace al {
namespace studio {

class PixelAudioBridge {
public:
  PixelAudioBridge(int width, int height, int channels = 4)
      : mWidth(width > 0 ? width : 1),
        mHeight(height > 0 ? height : 1),
        mChannels(channels > 0 ? channels : 1),
        mBuf(static_cast<size_t>(mWidth) * mHeight * mChannels, 0) {}

  // ---------------- Graphics-thread side (may allocate) ----------------

  // Returns a pointer to channel 0 of pixel (x, y). Caller writes
  // `mChannels` consecutive bytes. Out-of-range queries return nullptr.
  uint8_t* writePixel(int x, int y) {
    if (x < 0 || x >= mWidth || y < 0 || y >= mHeight) return nullptr;
    const size_t idx = (static_cast<size_t>(y) * mWidth + x) *
                       static_cast<size_t>(mChannels);
    return mBuf.data() + idx;
  }

  // Bulk overwrite. Source must be exactly width*height*channels bytes;
  // shorter sources are clamped, longer sources are truncated.
  void uploadFrom(const std::vector<uint8_t>& src) {
    const size_t n = (src.size() < mBuf.size()) ? src.size() : mBuf.size();
    if (n > 0) std::memcpy(mBuf.data(), src.data(), n);
  }

  // ---------------- Audio-thread side (lock-free, no alloc) -------------

  // Copy row `row` into dst. dst must already be sized to at least
  // width*channels bytes; nothing is allocated here. Out-of-range rows
  // are silently ignored (dst is left untouched).
  void readRow(int row, std::vector<uint8_t>& dst) const {
    if (row < 0 || row >= mHeight) return;
    const size_t bytesPerRow =
        static_cast<size_t>(mWidth) * static_cast<size_t>(mChannels);
    if (dst.size() < bytesPerRow) return;
    const uint8_t* src = mBuf.data() +
                         static_cast<size_t>(row) * bytesPerRow;
    std::memcpy(dst.data(), src, bytesPerRow);
  }

  // Atomic row pointer accessors. Audio thread typically calls
  // currentRow(); graphics thread (or a sequencer) sets it.
  void setRow(int row) {
    if (row < 0) row = 0;
    if (row >= mHeight) row = mHeight - 1;
    mRow.store(row, std::memory_order_release);
  }

  int currentRow() const {
    return mRow.load(std::memory_order_acquire);
  }

  // ---------------- Shape -----------------------------------------------
  int width() const { return mWidth; }
  int height() const { return mHeight; }
  int channels() const { return mChannels; }

private:
  int mWidth;
  int mHeight;
  int mChannels;
  std::vector<uint8_t> mBuf;
  std::atomic<int> mRow{0};
};

}  // namespace studio
}  // namespace al
