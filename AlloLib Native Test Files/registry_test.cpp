// Phase 1 unit test — verifies al::ParameterRegistry behaves correctly.
//
// Build (native AlloLib):
//   ./run.sh registry_test.cpp
//
// Expected output:
//   [registry] count=0 (empty)
//   [registry] add(p1) returned 1 (true=added)
//   [registry] count=1 has(p1)=1
//   [registry] add(p1) returned 0 (false=already present, dedup)
//   [registry] count=1 (still 1)
//   [registry] add(p2) returned 1 (true)
//   [registry] count=2 at(0)=<p1> at(1)=<p2>
//   [registry] version() bumped on every real add: deltas 1, 0, 1
//   [registry] onChange fired 2 times for adds, 1 time for clear
//   [registry] clear: count=0 has(p1)=0
//
// On a successful run every assertion passes (`assert` aborts on
// failure). The test runs natively against vanilla AlloLib so the
// Studio Online compat layer can't influence the result.

#include <cassert>
#include <iostream>

#include "al/app/al_App.hpp"
#include "al/ui/al_Parameter.hpp"

#include "al_parameter_registry.hpp"

using namespace al;

int main() {
  auto& reg = ParameterRegistry::global();

  // Start state: empty.
  assert(reg.count() == 0);
  std::cout << "[registry] count=0 (empty)" << std::endl;

  Parameter p1{"p1", "", 0.5f, 0.0f, 1.0f};
  Parameter p2{"p2", "", 100.0f, 0.0f, 1000.0f};

  // Track callbacks.
  int addEvents = 0, clearEvents = 0;
  auto tok = reg.onChange([&](ParameterMeta* p) {
    if (p) ++addEvents; else ++clearEvents;
  });

  // First add — true.
  uint64_t v0 = reg.version();
  bool added = reg.add(&p1);
  assert(added == true);
  std::cout << "[registry] add(p1) returned " << added << " (true=added)"
            << std::endl;
  assert(reg.count() == 1);
  assert(reg.has(&p1));
  assert(reg.version() == v0 + 1);
  std::cout << "[registry] count=1 has(p1)=" << reg.has(&p1) << std::endl;

  // Duplicate add — false; version unchanged.
  uint64_t v1 = reg.version();
  added = reg.add(&p1);
  assert(added == false);
  std::cout << "[registry] add(p1) returned " << added
            << " (false=already present, dedup)" << std::endl;
  assert(reg.count() == 1);
  assert(reg.version() == v1);
  std::cout << "[registry] count=1 (still 1)" << std::endl;

  // Second distinct add.
  added = reg.add(&p2);
  assert(added == true);
  std::cout << "[registry] add(p2) returned " << added << " (true)"
            << std::endl;
  assert(reg.count() == 2);
  assert(reg.at(0) == &p1);
  assert(reg.at(1) == &p2);
  std::cout << "[registry] count=2 at(0)=" << reg.at(0)
            << " at(1)=" << reg.at(1) << std::endl;

  // Out-of-range indexed access returns nullptr.
  assert(reg.at(99) == nullptr);

  // Snapshot is a defensive copy.
  auto snap = reg.snapshot();
  assert(snap.size() == 2);
  assert(snap[0] == &p1 && snap[1] == &p2);

  // Version bumps verified in steps above (1, 0, 1).
  std::cout << "[registry] version() bumped on every real add: deltas 1, 0, 1"
            << std::endl;

  // Clear fires onChange(nullptr) and zeroes count.
  reg.clear();
  assert(reg.count() == 0);
  assert(!reg.has(&p1));
  assert(addEvents == 2);
  assert(clearEvents == 1);
  std::cout << "[registry] onChange fired " << addEvents
            << " times for adds, " << clearEvents
            << " time for clear" << std::endl;
  std::cout << "[registry] clear: count=0 has(p1)=" << reg.has(&p1)
            << std::endl;

  // Unsubscribe drops the listener; subsequent adds don't fire it.
  reg.unsubscribe(tok);
  reg.add(&p1);
  assert(addEvents == 2);  // unchanged

  std::cout << "[registry] all assertions passed" << std::endl;
  return 0;
}
