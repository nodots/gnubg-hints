#include "hint_wrapper.h"
#include <functional>
#include <algorithm>

// Global state definition
namespace gnubg_addon {
    struct ModuleState {
        bool initialized = false;
        std::string weightsPath;
        HintConfig config;
    };

    // Define the global state here
    ModuleState g_state;
}

// GNU Backgammon includes - minimal required types and functions
extern "C" {
    // Basic types needed (avoiding full glib dependency)
    typedef int gboolean;
    #define TRUE 1
    #define FALSE 0

    // GNU Backgammon board representation
    typedef unsigned int TanBoard[2][25];

    // Basic evaluation context
    typedef struct _evalcontext {
        int nPlies;
        int fCubeful;
        int fUsePrune;
        float rNoise;
    } evalcontext;

    // Match state structure (simplified)
    typedef struct _matchstate {
        TanBoard anBoard;
        unsigned int anDice[2];
        int fTurn;
        int fMove;
        int fCubeOwner;
        int nCube;
        int anScore[2];
        int nMatchTo;
        int fCrawford;
        int fJacoby;
    } matchstate;

    // Cube info structure
    typedef struct _cubeinfo {
        int nCube;
        int fCubeOwner;
        int fMove;
        int nMatchTo;
        int anScore[2];
        int fCrawford;
        int fJacoby;
        int fBeavers;
    } cubeinfo;

    // Simple move representation
    typedef struct _move {
        int anMove[8];
        float rScore;
        float rScore2;
    } move;

    typedef struct _movelist {
        unsigned int cMoves;
        unsigned int cMaxMoves;
        int iMoveBest;
        move *amMoves;
    } movelist;

    // Real GNU Backgammon functions from gnubg_core.h
    #include "../include/gnubg_core.h"
    extern void PositionFromID(TanBoard anBoard, const char* pchEnc);
}

namespace gnubg_addon {

// Static member initialization
bool HintWrapper::s_initialized = false;
HintConfig HintWrapper::s_config;

// Functional factory implementation for HintConfig
HintConfig HintConfig::fromJsObject(const Napi::Object& obj) {
    return HintConfig {
        .evalPlies = obj.Has("evalPlies") ? obj.Get("evalPlies").As<Napi::Number>().Int32Value() : 2,
        .moveFilter = obj.Has("moveFilter") ? obj.Get("moveFilter").As<Napi::Number>().Int32Value() : 2,
        .threadCount = obj.Has("threadCount") ? obj.Get("threadCount").As<Napi::Number>().Int32Value() : 1,
        .usePruning = obj.Has("usePruning") ? obj.Get("usePruning").As<Napi::Boolean>().Value() : true,
        .noise = obj.Has("noise") ? obj.Get("noise").As<Napi::Number>().DoubleValue() : 0.0
    };
}

// Functional factory implementation for HintRequest
HintRequest HintRequest::fromJsObject(const Napi::Object& obj) {
    HintRequest request;

    // Extract board
    if (obj.Has("board")) {
        Napi::Array boardArray = obj.Get("board").As<Napi::Array>();
        for (uint32_t player = 0; player < 2; player++) {
            Napi::Array playerArray = boardArray.Get(player).As<Napi::Array>();
            for (uint32_t point = 0; point < 25; point++) {
                request.board[player][point] = playerArray.Get(point).As<Napi::Number>().Int32Value();
            }
        }
    }

    // Extract dice
    if (obj.Has("dice")) {
        Napi::Array diceArray = obj.Get("dice").As<Napi::Array>();
        request.dice[0] = diceArray.Get(uint32_t(0)).As<Napi::Number>().Int32Value();
        request.dice[1] = diceArray.Get(uint32_t(1)).As<Napi::Number>().Int32Value();
    }

    // Extract cube info
    request.cubeValue = obj.Get("cubeValue").As<Napi::Number>().Int32Value();

    // Handle cubeOwner which can be null
    Napi::Value cubeOwnerValue = obj.Get("cubeOwner");
    if (cubeOwnerValue.IsNull() || cubeOwnerValue.IsUndefined()) {
        request.cubeOwner = -1; // -1 indicates no owner (centered cube)
    } else {
        request.cubeOwner = cubeOwnerValue.As<Napi::Number>().Int32Value();
    }

    // Extract match info
    if (obj.Has("matchScore")) {
        Napi::Array scoreArray = obj.Get("matchScore").As<Napi::Array>();
        request.matchScore[0] = scoreArray.Get(uint32_t(0)).As<Napi::Number>().Int32Value();
        request.matchScore[1] = scoreArray.Get(uint32_t(1)).As<Napi::Number>().Int32Value();
    }

    request.matchLength = obj.Get("matchLength").As<Napi::Number>().Int32Value();
    request.crawford = obj.Get("crawford").As<Napi::Boolean>().Value();
    request.jacoby = obj.Get("jacoby").As<Napi::Boolean>().Value();
    request.beavers = obj.Get("beavers").As<Napi::Boolean>().Value();

    // Extract position ID if provided
    if (obj.Has("positionId")) {
        request.positionId = obj.Get("positionId").As<Napi::String>().Utf8Value();
    } else {
        request.positionId = "";  // Default to empty string
    }

    return request;
}

// Convert Evaluation to JS object
Napi::Object Evaluation::toJsObject(Napi::Env env) const {
    auto obj = Napi::Object::New(env);
    obj.Set("win", Napi::Number::New(env, win));
    obj.Set("winGammon", Napi::Number::New(env, winGammon));
    obj.Set("winBackgammon", Napi::Number::New(env, winBackgammon));
    obj.Set("loseGammon", Napi::Number::New(env, loseGammon));
    obj.Set("loseBackgammon", Napi::Number::New(env, loseBackgammon));
    obj.Set("equity", Napi::Number::New(env, equity));
    obj.Set("cubefulEquity", Napi::Number::New(env, cubefulEquity));
    return obj;
}

// Convert Move to JS object
Napi::Object Move::toJsObject(Napi::Env env) const {
    auto obj = Napi::Object::New(env);

    // Convert steps array
    auto stepsArray = Napi::Array::New(env, steps.size());
    for (size_t i = 0; i < steps.size(); i++) {
        auto step = Napi::Array::New(env, 2);
        step.Set(uint32_t(0), Napi::Number::New(env, steps[i][0]));
        step.Set(uint32_t(1), Napi::Number::New(env, steps[i][1]));
        stepsArray.Set(uint32_t(i), step);
    }

    obj.Set("moves", stepsArray);
    obj.Set("evaluation", eval.toJsObject(env));
    obj.Set("equity", Napi::Number::New(env, equity));
    obj.Set("rank", Napi::Number::New(env, rank));

    return obj;
}

// Convert DoubleHint to JS object
Napi::Object DoubleHint::toJsObject(Napi::Env env) const {
    auto obj = Napi::Object::New(env);
    obj.Set("action", Napi::String::New(env, action));
    obj.Set("takePoint", Napi::Number::New(env, takePoint));
    obj.Set("dropPoint", Napi::Number::New(env, dropPoint));
    obj.Set("evaluation", eval.toJsObject(env));
    obj.Set("cubefulEquity", Napi::Number::New(env, cubefulEquity));
    return obj;
}

// Convert TakeHint to JS object
Napi::Object TakeHint::toJsObject(Napi::Env env) const {
    auto obj = Napi::Object::New(env);
    obj.Set("action", Napi::String::New(env, action));
    obj.Set("evaluation", eval.toJsObject(env));
    obj.Set("takeEquity", Napi::Number::New(env, takeEquity));
    obj.Set("dropEquity", Napi::Number::New(env, dropEquity));
    return obj;
}

// HintWrapper implementation
bool HintWrapper::initialize(const std::string& weightsPath) {
    if (s_initialized) {
        return true;
    }

    // Initialize GNU Backgammon engine
    int result = gnubg_initialize();
    if (result != 0) {
        return false;
    }

    s_initialized = true;
    return s_initialized;
}

void HintWrapper::shutdown() {
    if (s_initialized) {
        // Shutdown GNU Backgammon evaluation engine
        gnubg_shutdown();
        s_initialized = false;
    }
}

void HintWrapper::configure(const HintConfig& config) {
    s_config = config;
    // Configuration is now stored and applied when hints are requested
}

std::vector<Move> HintWrapper::getMoveHints(const HintRequest& request, int maxHints) {
    std::vector<Move> results;

    if (!s_initialized) {
        throw std::runtime_error("GnuBgHints not initialized");
    }

    // Convert HintRequest to GNU Backgammon format
    TanBoard board;
    int dice[2] = {request.dice[0], request.dice[1]};

    // Convert board representation
    for (int player = 0; player < 2; player++) {
        for (int point = 0; point < 25; point++) {
            board[player][point] = request.board[player][point];
        }
    }

    // Get move hints from GNU Backgammon
    movelist ml;
    ml.cMoves = 0;
    ml.cMaxMoves = maxHints;
    ml.amMoves = new move[maxHints];

    // Use position ID if provided, otherwise use board representation
    int result;
    if (!request.positionId.empty()) {
        // Convert position ID to board
        PositionFromID(board, request.positionId.c_str());
    }

    // Call real GNU Backgammon hint function
    result = gnubg_hint_move(board, dice, ml.amMoves, maxHints);
    ml.cMoves = (result > 0) ? result : 0;
    if (result > 0) {
        // Convert GNU BG moves to our Move structure
        for (unsigned int i = 0; i < ml.cMoves && i < (unsigned int)maxHints; i++) {
            Move hint;

            // Convert anMove array to move steps
            for (int j = 0; j < 8; j += 2) {
                if (ml.amMoves[i].anMove[j] >= 0) {
                    std::array<int, 2> step = {ml.amMoves[i].anMove[j], ml.amMoves[i].anMove[j+1]};
                    hint.steps.push_back(step);
                }
            }

            // Set evaluation data
            hint.eval.equity = ml.amMoves[i].rScore;
            hint.equity = ml.amMoves[i].rScore;
            hint.rank = i + 1;

            results.push_back(hint);
        }
    }

    delete[] ml.amMoves;
    return results;
}

DoubleHint HintWrapper::getDoubleHint(const HintRequest& request) {
    DoubleHint result;

    if (!s_initialized) {
        throw std::runtime_error("GnuBgHints not initialized");
    }

    // Convert HintRequest to GNU Backgammon format
    TanBoard board;
    cubeinfo ci;

    // Convert board representation
    for (int player = 0; player < 2; player++) {
        for (int point = 0; point < 25; point++) {
            board[player][point] = request.board[player][point];
        }
    }

    // Set up cube info
    ci.nCube = request.cubeValue;
    ci.fCubeOwner = request.cubeOwner;
    ci.nMatchTo = request.matchLength;
    ci.anScore[0] = request.matchScore[0];
    ci.anScore[1] = request.matchScore[1];
    ci.fCrawford = request.crawford ? TRUE : FALSE;
    ci.fJacoby = request.jacoby ? TRUE : FALSE;
    ci.fBeavers = request.beavers ? TRUE : FALSE;

    // Get double hint from GNU Backgammon
    float equity = 0.0f;
    int gnubgResult = gnubg_hint_double(board, &ci, &equity);

    if (gnubgResult == 0) {
        // Determine action based on GNU BG evaluation
        auto determineAction = [](double eq) -> std::string {
            if (eq > 1.0) return "too-good";
            if (eq > 0.5) return "double";
            return "no-double";
        };

        result.action = determineAction(equity);
        result.eval.equity = equity;
        result.cubefulEquity = equity;
    } else {
        result.action = "no-double";
    }

    return result;
}

TakeHint HintWrapper::getTakeHint(const HintRequest& request) {
    TakeHint result;

    if (!s_initialized) {
        throw std::runtime_error("GnuBgHints not initialized");
    }

    // Convert HintRequest to GNU Backgammon format
    TanBoard board;
    cubeinfo ci;

    // Convert board representation
    for (int player = 0; player < 2; player++) {
        for (int point = 0; point < 25; point++) {
            board[player][point] = request.board[player][point];
        }
    }

    // Set up cube info
    ci.nCube = request.cubeValue;
    ci.fCubeOwner = request.cubeOwner;
    ci.nMatchTo = request.matchLength;
    ci.anScore[0] = request.matchScore[0];
    ci.anScore[1] = request.matchScore[1];
    ci.fCrawford = request.crawford ? TRUE : FALSE;
    ci.fJacoby = request.jacoby ? TRUE : FALSE;
    ci.fBeavers = request.beavers ? TRUE : FALSE;

    // Get take hint from GNU Backgammon
    float takeEquity = 0.0f, dropEquity = -1.0f;
    int gnubgResult = gnubg_hint_take(board, &ci, &takeEquity);

    if (gnubgResult == 0) {
        // Determine action based on equity comparison
        auto determineAction = [](double take, double drop) -> std::string {
            return take > drop ? "take" : "drop";
        };

        result.action = determineAction(takeEquity, dropEquity);
        result.takeEquity = takeEquity;
        result.dropEquity = dropEquity;
        result.eval.equity = takeEquity;
    } else {
        result.action = "drop";
        result.takeEquity = -2.0;
        result.dropEquity = -1.0;
    }

    return result;
}

// Async worker implementations
InitializeWorker::InitializeWorker(Napi::Function& callback, const std::string& weightsPath)
    : Napi::AsyncWorker(callback), m_weightsPath(weightsPath), m_success(false) {}

void InitializeWorker::Execute() {
    m_success = HintWrapper::initialize(m_weightsPath);
    if (!m_success) {
        SetError("Failed to initialize GNU Backgammon engine");
    }
}

void InitializeWorker::OnOK() {
    // Set global state to indicate successful initialization
    gnubg_addon::g_state.initialized = true;
    gnubg_addon::g_state.weightsPath = m_weightsPath;

    Callback().Call({Env().Null()});
}

void InitializeWorker::OnError(const Napi::Error& error) {
    Callback().Call({error.Value()});
}

MoveHintWorker::MoveHintWorker(Napi::Function& callback, const HintRequest& request,
                               int maxHints, const HintConfig& config)
    : Napi::AsyncWorker(callback), m_request(request), m_maxHints(maxHints), m_config(config) {}

void MoveHintWorker::Execute() {
    HintWrapper::configure(m_config);
    m_results = HintWrapper::getMoveHints(m_request, m_maxHints);
}

void MoveHintWorker::OnOK() {
    auto env = Env();
    auto resultArray = Napi::Array::New(env, m_results.size());

    for (size_t i = 0; i < m_results.size(); i++) {
        resultArray.Set(uint32_t(i), m_results[i].toJsObject(env));
    }

    Callback().Call({env.Null(), resultArray});
}

DoubleHintWorker::DoubleHintWorker(Napi::Function& callback, const HintRequest& request,
                                   const HintConfig& config)
    : Napi::AsyncWorker(callback), m_request(request), m_config(config) {}

void DoubleHintWorker::Execute() {
    HintWrapper::configure(m_config);
    m_result = HintWrapper::getDoubleHint(m_request);
}

void DoubleHintWorker::OnOK() {
    Callback().Call({Env().Null(), m_result.toJsObject(Env())});
}

TakeHintWorker::TakeHintWorker(Napi::Function& callback, const HintRequest& request,
                               const HintConfig& config)
    : Napi::AsyncWorker(callback), m_request(request), m_config(config) {}

void TakeHintWorker::Execute() {
    HintWrapper::configure(m_config);
    m_result = HintWrapper::getTakeHint(m_request);
}

void TakeHintWorker::OnOK() {
    Callback().Call({Env().Null(), m_result.toJsObject(Env())});
}

} // namespace gnubg_addon