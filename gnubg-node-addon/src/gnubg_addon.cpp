#include <napi.h>
#include "hint_wrapper.h"

namespace gnubg_addon {

// Module state
struct ModuleState {
    bool initialized = false;
    std::string weightsPath;
    HintConfig config;
};

extern ModuleState g_state;

// Initialize the GNU Backgammon engine
Napi::Value Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Expected (weightsPath, callback)").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string weightsPath = info[0].IsString() ? info[0].As<Napi::String>().Utf8Value() : "";
    Napi::Function callback = info[1].As<Napi::Function>();

    // Initialize in a worker thread to avoid blocking
    auto* asyncWorker = new InitializeWorker(callback, weightsPath);
    asyncWorker->Queue();

    return env.Undefined();
}

// Configure the hint engine
Napi::Value Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!g_state.initialized) {
        Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected configuration object").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Update configuration using functional approach
    g_state.config = HintConfig::fromJsObject(config);

    return env.Undefined();
}

// Get move hints
Napi::Value GetMoveHints(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!g_state.initialized) {
        Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 3 || !info[2].IsFunction()) {
        Napi::TypeError::New(env, "Expected (request, maxHints, callback)").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto request = HintRequest::fromJsObject(info[0].As<Napi::Object>());
    int maxHints = info[1].As<Napi::Number>().Int32Value();
    Napi::Function callback = info[2].As<Napi::Function>();

    // Execute in worker thread
    auto* asyncWorker = new MoveHintWorker(callback, request, maxHints, g_state.config);
    asyncWorker->Queue();

    return env.Undefined();
}

// Get double hint
Napi::Value GetDoubleHint(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!g_state.initialized) {
        Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 2 || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Expected (request, callback)").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto request = HintRequest::fromJsObject(info[0].As<Napi::Object>());
    Napi::Function callback = info[1].As<Napi::Function>();

    // Execute in worker thread
    auto* asyncWorker = new DoubleHintWorker(callback, request, g_state.config);
    asyncWorker->Queue();

    return env.Undefined();
}

// Get take hint
Napi::Value GetTakeHint(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!g_state.initialized) {
        Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 2 || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Expected (request, callback)").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto request = HintRequest::fromJsObject(info[0].As<Napi::Object>());
    Napi::Function callback = info[1].As<Napi::Function>();

    // Execute in worker thread
    auto* asyncWorker = new TakeHintWorker(callback, request, g_state.config);
    asyncWorker->Queue();

    return env.Undefined();
}

// Shutdown the engine
Napi::Value Shutdown(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (g_state.initialized) {
        HintWrapper::shutdown();
        g_state.initialized = false;
    }

    return env.Undefined();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("configure", Napi::Function::New(env, Configure));
    exports.Set("getMoveHints", Napi::Function::New(env, GetMoveHints));
    exports.Set("getDoubleHint", Napi::Function::New(env, GetDoubleHint));
    exports.Set("getTakeHint", Napi::Function::New(env, GetTakeHint));
    exports.Set("shutdown", Napi::Function::New(env, Shutdown));

    return exports;
}

NODE_API_MODULE(gnubg_hints, Init)

} // namespace gnubg_addon