/**
 * Web-specific demangle implementation
 *
 * Uses cxxabi for Emscripten (clang-based)
 */

#ifdef __EMSCRIPTEN__

#include <cxxabi.h>
#include <cstdlib>
#include <memory>
#include <string>

namespace al {

std::string demangle(const char* name) {
    int status = -4;
    std::unique_ptr<char, void(*)(void*)> res{
        abi::__cxa_demangle(name, nullptr, nullptr, &status),
        std::free
    };
    return (status == 0) ? res.get() : name;
}

} // namespace al

#endif // __EMSCRIPTEN__
