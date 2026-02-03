#!/usr/bin/env ts-node
/**
 * Compilation Test Suite
 *
 * Tests the C++ to WASM compilation pipeline without requiring a browser.
 * Verifies that code compiles correctly and produces valid WASM output.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

interface CompilationResult {
  success: boolean
  time: number
  output?: string
  error?: string
  wasmSize?: number
  jsSize?: number
}

interface TestCase {
  name: string
  code: string
  expectedSuccess: boolean
  expectedError?: string
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

// Test cases
const testCases: TestCase[] = [
  {
    name: 'Minimal App',
    code: `
#include "al/app/al_App.hpp"
struct MyApp : al::App {
  void onDraw(al::Graphics& g) override {
    g.clear(0.1, 0.1, 0.1);
  }
};
int main() { MyApp().start(); }
`,
    expectedSuccess: true,
  },
  {
    name: 'App with Mesh',
    code: `
#include "al/app/al_App.hpp"
struct MyApp : al::App {
  al::Mesh mesh;
  void onCreate() override {
    addSphere(mesh, 0.5);
    nav().pos(0, 0, 3);
  }
  void onDraw(al::Graphics& g) override {
    g.clear(0.1, 0.1, 0.1);
    g.color(1, 0.5, 0);
    g.draw(mesh);
  }
};
int main() { MyApp().start(); }
`,
    expectedSuccess: true,
  },
  {
    name: 'App with Texture',
    code: `
#include "al/app/al_App.hpp"
struct MyApp : al::App {
  al::Texture tex;
  al::Mesh quad;
  void onCreate() override {
    std::vector<uint8_t> pixels(64*64*4, 255);
    tex.create2D(64, 64);
    tex.submit(pixels.data());
    quad.primitive(al::Mesh::TRIANGLE_STRIP);
    quad.vertex(-1,-1,0); quad.texCoord(0,0);
    quad.vertex(1,-1,0); quad.texCoord(1,0);
    quad.vertex(-1,1,0); quad.texCoord(0,1);
    quad.vertex(1,1,0); quad.texCoord(1,1);
  }
  void onDraw(al::Graphics& g) override {
    g.clear(0.2);
    tex.bind(0);
    g.texture();
    g.draw(quad);
    tex.unbind(0);
  }
};
int main() { MyApp().start(); }
`,
    expectedSuccess: true,
  },
  {
    name: 'App with Audio',
    code: `
#include "al/app/al_App.hpp"
struct MyApp : al::App {
  float phase = 0;
  void onSound(al::AudioIOData& io) override {
    while(io()) {
      float s = std::sin(phase) * 0.1;
      phase += 440.0 * 2 * M_PI / io.framesPerSecond();
      io.out(0) = s;
      io.out(1) = s;
    }
  }
  void onDraw(al::Graphics& g) override { g.clear(0.1); }
};
int main() { MyApp().start(); }
`,
    expectedSuccess: true,
  },
  {
    name: 'App with Parameters',
    code: `
#include "al/app/al_App.hpp"
#include "al/ui/al_ControlGUI.hpp"
#include "al/ui/al_Parameter.hpp"
struct MyApp : al::App {
  al::Parameter freq{"freq", "", 440, 20, 2000};
  void onCreate() override {}
  void onDraw(al::Graphics& g) override { g.clear(0.1); }
};
int main() { MyApp().start(); }
`,
    expectedSuccess: true,
  },
  {
    name: 'Syntax Error - Missing Semicolon',
    code: `
#include "al/app/al_App.hpp"
struct MyApp : al::App {
  void onDraw(al::Graphics& g) override {
    g.clear(0.1) // Missing semicolon
  }
};
int main() { MyApp().start(); }
`,
    expectedSuccess: false,
    expectedError: 'expected',
  },
  {
    name: 'Type Error - Wrong Argument Type',
    code: `
#include "al/app/al_App.hpp"
struct MyApp : al::App {
  void onDraw(al::Graphics& g) override {
    g.clear("red"); // Wrong type
  }
};
int main() { MyApp().start(); }
`,
    expectedSuccess: false,
  },
  {
    name: 'Link Error - Undefined Function',
    code: `
#include "al/app/al_App.hpp"
void undefinedFunction();
struct MyApp : al::App {
  void onDraw(al::Graphics& g) override {
    g.clear(0.1);
    undefinedFunction();
  }
};
int main() { MyApp().start(); }
`,
    expectedSuccess: false,
    expectedError: 'undefined',
  },
]

async function compileCode(code: string): Promise<CompilationResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const postData = JSON.stringify({ code, backend: 'webgl2' })

    const req = http.request(`${BACKEND_URL}/api/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 120000,
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        const time = Date.now() - startTime

        try {
          const json = JSON.parse(data)

          if (json.success) {
            resolve({
              success: true,
              time,
              output: json.output,
              wasmSize: json.wasmSize,
              jsSize: json.jsSize,
            })
          } else {
            resolve({
              success: false,
              time,
              error: json.error || json.message,
            })
          }
        } catch (e) {
          resolve({
            success: false,
            time,
            error: `Parse error: ${e}`,
          })
        }
      })
    })

    req.on('error', (e) => {
      resolve({
        success: false,
        time: Date.now() - startTime,
        error: `Request error: ${e.message}`,
      })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({
        success: false,
        time: Date.now() - startTime,
        error: 'Compilation timeout',
      })
    })

    req.write(postData)
    req.end()
  })
}

async function runTests(): Promise<void> {
  console.log('\n🔨 AlloLib Compilation Test Suite\n')
  console.log('='.repeat(60))

  const results: { test: TestCase; result: CompilationResult; passed: boolean }[] = []

  for (const testCase of testCases) {
    process.stdout.write(`  ${testCase.name.padEnd(40)} `)

    const result = await compileCode(testCase.code)

    // Determine if test passed
    let passed = false
    if (testCase.expectedSuccess) {
      passed = result.success
    } else {
      passed = !result.success
      if (testCase.expectedError && result.error) {
        passed = passed && result.error.toLowerCase().includes(testCase.expectedError.toLowerCase())
      }
    }

    results.push({ test: testCase, result, passed })

    // Print result
    if (passed) {
      console.log(`✅ PASS (${result.time}ms)`)
    } else {
      console.log(`❌ FAIL (${result.time}ms)`)
      if (result.error) {
        console.log(`     Error: ${result.error.slice(0, 100)}...`)
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)

  // Write detailed results to file
  const outputDir = path.join(__dirname, '../../test-results/compilation')
  fs.mkdirSync(outputDir, { recursive: true })

  const report = {
    timestamp: new Date().toISOString(),
    summary: { passed, failed, total: results.length },
    results: results.map(r => ({
      name: r.test.name,
      passed: r.passed,
      time: r.result.time,
      expectedSuccess: r.test.expectedSuccess,
      actualSuccess: r.result.success,
      error: r.result.error,
      wasmSize: r.result.wasmSize,
      jsSize: r.result.jsSize,
    })),
  }

  fs.writeFileSync(
    path.join(outputDir, 'results.json'),
    JSON.stringify(report, null, 2)
  )

  console.log(`📁 Detailed results: ${outputDir}/results.json\n`)

  // Exit with error code if tests failed
  if (failed > 0) {
    process.exit(1)
  }
}

// Check if backend is available
async function checkBackend(): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(`${BACKEND_URL}/health`, (res) => {
      resolve(res.statusCode === 200)
    }).on('error', () => resolve(false))
  })
}

async function main() {
  const backendUp = await checkBackend()

  if (!backendUp) {
    console.error(`\n❌ Backend not available at ${BACKEND_URL}`)
    console.error('   Please start the backend server first:\n')
    console.error('   cd backend && npm run dev\n')
    process.exit(1)
  }

  await runTests()
}

main().catch(console.error)
