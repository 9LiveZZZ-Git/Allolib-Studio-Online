# Security Policy

## Supported Versions

Only the latest version is supported with security updates.

| Version | Supported |
| ------- | --------- |
| 0.2.x   | ✅ |
| < 0.2   | ❌ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in AlloLib Studio Online, please report it responsibly:

1. **Email:** lpfreiburg@ucsb.edu with the subject line `[SECURITY] AlloLib Studio Online`
2. Include:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested mitigations

You should receive a response within 72 hours. If the issue is confirmed, we will work on a fix and coordinate disclosure.

## Scope

Within scope:
- The frontend web application (Vue 3, deployed to GitHub Pages)
- The backend compilation server (Node.js/Express, Railway-deployed)
- The Emscripten compilation pipeline
- The WASM runtime and rendering backends

Out of scope:
- Vulnerabilities in third-party dependencies (report to the upstream project)
- Attacks requiring physical access to a user's machine
- Social engineering

## Known Security Considerations

### User-Submitted C++ Compilation

The backend accepts arbitrary C++ code from users and compiles it to WebAssembly. Compilation is sandboxed in a Docker container with:
- Restricted file system access (read-only AlloLib headers, write-only output directory)
- No network access from within the compiler container
- CPU and memory limits
- Automatic job cleanup

Compiled WASM runs entirely in the user's browser in a standard web sandbox.

### Content Security

- All user code compiles to WASM and runs in the browser's sandbox (same as any web script)
- No persistent storage on the backend — compiled outputs are cleaned up after serving
- CORS configured to only accept requests from the deployed frontend origin

### Dependencies

We rely on well-maintained upstream projects. Critical dependencies:
- **Emscripten** — compilation toolchain (actively maintained)
- **AlloLib** — C++ framework (academic, MIT-licensed)
- **Node.js / Express** — backend runtime
- **Vite / Vue 3** — frontend build and runtime

Use `npm audit` to check for known vulnerabilities in JavaScript dependencies.

## Responsible Disclosure

We follow a coordinated disclosure timeline:
- **Day 0:** Report received, acknowledgment within 72 hours
- **Day 0-7:** Triage and validation
- **Day 7-30:** Fix development and testing
- **Day 30:** Coordinated public disclosure and patch release

We will credit reporters in the release notes unless anonymity is requested.

## Contact

- Security contact: lpfreiburg@ucsb.edu
- General issues: [GitHub Issues](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/issues)
- Project maintainer: Luc Freiburg (@9LiveZZZ-Git)

---

Thank you for helping keep AlloLib Studio Online and its users safe.
