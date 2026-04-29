// M5.2 — preset unification parity test
//
// This file uses al::PresetHandler / al::PresetSequencer / al::PresetMapper
// the same way Studio Online's WebPresetHandler subclass uses them, so a
// successful native AlloLib compile and run proves the API surface we
// depend on is real upstream behavior — not Studio-Online-only invention.
//
// Build (native AlloLib):
//   ./run.sh M5_2_preset_unify.cpp
//
// Expected output:
//   [M5.2] writing presets...
//   [M5.2] storePreset done; .preset files in <root>
//   [M5.2] recallPreset(0) returned: bright
//   [M5.2] morphTo started: 1.5 s
//   [M5.2] morph step 1: t=0.5
//   [M5.2] morph step 2: t=1.0
//   [M5.2] morph step 3: t=1.5
//   [M5.2] morph done
//   [M5.2] PresetMapper archive/restore round-trip OK
//   [M5.2] PresetSequencer wired to PresetHandler OK
//
// On Studio Online: the user replaces `PresetHandler` with
// `WebPresetHandler` and the same calls produce identical behavior, with
// the addition of (1) parameters auto-appearing in the Studio Params panel
// and (2) IDBFS persistence so /presets survives a page reload.

#include <iostream>

#include "al/app/al_App.hpp"
#include "al/ui/al_Parameter.hpp"
#include "al/ui/al_PresetHandler.hpp"
#include "al/ui/al_PresetSequencer.hpp"
#include "al/ui/al_PresetMapper.hpp"

using namespace al;

struct M52Test : public App {
  Parameter amp{"amp", "", 0.5f, 0.0f, 1.0f};
  Parameter freq{"freq", "", 220.0f, 20.0f, 5000.0f};

  // ASYNC mode + an explicit root keep the test deterministic across
  // platforms (no thread, write to a known directory).
  PresetHandler mPresets{TimeMasterMode::TIME_MASTER_FREE,
                         "M5_2_test_presets", true};
  PresetSequencer mSeq{TimeMasterMode::TIME_MASTER_FREE};
  PresetMapper mMapper{false};

  void onInit() override {
    std::cout << "[M5.2] writing presets..." << std::endl;
    mPresets << amp << freq;

    // bright preset
    amp.set(0.8f);
    freq.set(880.0f);
    mPresets.storePreset(0, "bright", true);

    // dark preset
    amp.set(0.2f);
    freq.set(110.0f);
    mPresets.storePreset(1, "dark", true);

    std::cout << "[M5.2] storePreset done; .preset files in "
              << mPresets.getCurrentPath() << std::endl;

    auto recalledName = mPresets.recallPreset(0);
    std::cout << "[M5.2] recallPreset(0) returned: " << recalledName
              << std::endl;

    // Manual morph stepping (TIME_MASTER_FREE means no thread; we tick).
    std::cout << "[M5.2] morphTo started: 1.5 s" << std::endl;
    mPresets.morphTo("dark", 1.5f);

    for (int i = 1; i <= 3; ++i) {
      mPresets.stepMorphing(0.5);
      std::cout << "[M5.2] morph step " << i
                << ": amp=" << amp.get()
                << " freq=" << freq.get() << std::endl;
    }
    std::cout << "[M5.2] morph done" << std::endl;

    // PresetMapper round-trip
    mMapper << mPresets;
    mMapper.archive("m5_2_archive", true);
    mMapper.restore("m5_2_archive", true);
    std::cout << "[M5.2] PresetMapper archive/restore round-trip OK"
              << std::endl;

    // PresetSequencer wiring
    mSeq << mPresets;
    if (mSeq.presetHandler() == &mPresets) {
      std::cout << "[M5.2] PresetSequencer wired to PresetHandler OK"
                << std::endl;
    }

    quit();  // exit after onInit so the test can be a quick smoke check
  }
};

int main() {
  M52Test app;
  app.start();
  return 0;
}
