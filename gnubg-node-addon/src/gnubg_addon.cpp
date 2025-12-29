#include <napi.h>
#include "hint_wrapper.h"

extern "C" {
#include "gnubg_core.h"
}

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

// Get position ID from board
Napi::Value GetPositionId(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected board array [2][25]").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array boardArr = info[0].As<Napi::Array>();
    if (boardArr.Length() != 2) {
        Napi::TypeError::New(env, "Board must have 2 players").ThrowAsJavaScriptException();
        return env.Null();
    }

    TanBoard board;
    for (int player = 0; player < 2; player++) {
        Napi::Array playerArr = boardArr.Get(player).As<Napi::Array>();
        if (playerArr.Length() != 25) {
            Napi::TypeError::New(env, "Each player must have 25 positions").ThrowAsJavaScriptException();
            return env.Null();
        }
        for (int pos = 0; pos < 25; pos++) {
            board[player][pos] = playerArr.Get(pos).As<Napi::Number>().Uint32Value();
        }
    }

    const char* positionId = gnubg_position_id(board);
    return Napi::String::New(env, positionId);
}

// Decode position ID to board array
Napi::Value DecodePositionId(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected position ID string").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string positionId = info[0].As<Napi::String>().Utf8Value();

    TanBoard board;
    int result = gnubg_position_from_id(board, positionId.c_str());

    if (!result) {
        Napi::Error::New(env, "Invalid position ID").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Convert board to JavaScript array [2][25]
    Napi::Array boardArr = Napi::Array::New(env, 2);
    for (int player = 0; player < 2; player++) {
        Napi::Array playerArr = Napi::Array::New(env, 25);
        for (int pos = 0; pos < 25; pos++) {
            playerArr.Set(pos, Napi::Number::New(env, board[player][pos]));
        }
        boardArr.Set(player, playerArr);
    }

    return boardArr;
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
    exports.Set("getPositionId", Napi::Function::New(env, GetPositionId));
    exports.Set("decodePositionId", Napi::Function::New(env, DecodePositionId));
    exports.Set("shutdown", Napi::Function::New(env, Shutdown));

    return exports;
}

NODE_API_MODULE(gnubg_hints, Init)

} // namespace gnubg_addon