#ifndef HINT_WRAPPER_H
#define HINT_WRAPPER_H

#include <napi.h>
#include <string>
#include <vector>
#include <array>

namespace gnubg_addon {

// Configuration structure
struct HintConfig {
    int evalPlies = 2;
    int moveFilter = 2;
    int threadCount = 1;
    bool usePruning = true;
    double noise = 0.0;

    // Functional factory method from JS object
    static HintConfig fromJsObject(const Napi::Object& obj);
};

// Request structure for hints
struct HintRequest {
    std::array<std::array<int, 25>, 2> board;  // GNU BG board format
    std::array<int, 2> dice;
    int cubeValue;
    int cubeOwner;  // -1 = centered, 0/1 = player
    std::array<int, 2> matchScore;
    int matchLength;
    bool crawford;
    bool jacoby;
    bool beavers;
    std::string positionId;  // Optional GNU Backgammon position ID
    bool hasBoard = false;

    // Optional explicit on-roll seat for cube/resign hints.
    //   -1 (default) → legacy behavior: player 0 (board[0], the opponent of
    //                  activePlayerColor) is on roll
    //    0           → board[0]'s player is on roll
    //    1           → board[1]'s player (= activePlayerColor) is on roll
    // Consumers that want a verdict for activePlayer itself should pass 1
    // for take/double hints, and 1 with the RESIGNER declared as
    // activePlayerColor for resign hints.
    int fMoveOverride = -1;

    // Optional offered concession for resign hints. When present (>0),
    // getResignHint skips its own getResignation verdict and reports
    // equityBefore/equityAfter for THIS concession size, letting the caller
    // apply external.c's rule: accept iff rEqAfter < rEqBefore.
    int offeredPoints = 0;

    // Functional factory method from JS object
    static HintRequest fromJsObject(const Napi::Object& obj);
};

// Evaluation output
struct Evaluation {
    double win;
    double winGammon;
    double winBackgammon;
    double loseGammon;
    double loseBackgammon;
    double equity;
    double cubefulEquity;

    Napi::Object toJsObject(Napi::Env env) const;
};

// Move representation
struct Move {
    std::vector<std::array<int, 2>> steps;  // [from, to] pairs
    Evaluation eval;
    double equity;
    int rank;

    Napi::Object toJsObject(Napi::Env env) const;
};

// Double hint result
struct DoubleHint {
    std::string action;  // "double", "no-double", "too-good", "beaver", "redouble"
    double takePoint;
    double dropPoint;
    Evaluation eval;
    double cubefulEquity;

    Napi::Object toJsObject(Napi::Env env) const;
};

// Take hint result
struct TakeHint {
    std::string action;  // "take", "drop", "beaver"
    Evaluation eval;
    double takeEquity;
    double dropEquity;

    Napi::Object toJsObject(Napi::Env env) const;
};

// Resignation hint result (gnubg's own getResignation +
// getResignEquities)
struct ResignHint {
    int resignedPoints;  // 0 = none, 1/2/3 = single/gammon/backgammon
    double equityBefore; // resigner's equity playing on
    double equityAfter;  // resigner's equity after the concession
    int decision;        // gnubg's accept/reject verdict: 1 = accept, 0 = reject

    Napi::Object toJsObject(Napi::Env env) const;
};

// Core wrapper class for GNU Backgammon functions
class HintWrapper {
public:
    static bool initialize(const std::string& weightsPath);
    static void shutdown();
    static void configure(const HintConfig& config);

    static std::vector<Move> getMoveHints(const HintRequest& request, int maxHints);
    static DoubleHint getDoubleHint(const HintRequest& request);
    static TakeHint getTakeHint(const HintRequest& request);
    static ResignHint getResignHint(const HintRequest& request);

private:
    static bool s_initialized;
    static HintConfig s_config;
};

// Async worker classes for non-blocking operations
class InitializeWorker : public Napi::AsyncWorker {
public:
    InitializeWorker(Napi::Function& callback, const std::string& weightsPath);
    void Execute() override;
    void OnOK() override;
    void OnError(const Napi::Error& error) override;

private:
    std::string m_weightsPath;
    bool m_success;
};

class MoveHintWorker : public Napi::AsyncWorker {
public:
    MoveHintWorker(Napi::Function& callback, const HintRequest& request,
                   int maxHints, const HintConfig& config);
    void Execute() override;
    void OnOK() override;
    void OnError(const Napi::Error& error) override;

private:
    HintRequest m_request;
    int m_maxHints;
    HintConfig m_config;
    std::vector<Move> m_results;
};

class DoubleHintWorker : public Napi::AsyncWorker {
public:
    DoubleHintWorker(Napi::Function& callback, const HintRequest& request,
                     const HintConfig& config);
    void Execute() override;
    void OnOK() override;
    void OnError(const Napi::Error& error) override;

private:
    HintRequest m_request;
    HintConfig m_config;
    DoubleHint m_result;
};

class TakeHintWorker : public Napi::AsyncWorker {
public:
    TakeHintWorker(Napi::Function& callback, const HintRequest& request,
                   const HintConfig& config);
    void Execute() override;
    void OnOK() override;
    void OnError(const Napi::Error& error) override;

private:
    HintRequest m_request;
    HintConfig m_config;
    TakeHint m_result;
};

class ResignHintWorker : public Napi::AsyncWorker {
public:
    ResignHintWorker(Napi::Function& callback, const HintRequest& request,
                     const HintConfig& config);
    void Execute() override;
    void OnOK() override;
    void OnError(const Napi::Error& error) override;

private:
    HintRequest m_request;
    HintConfig m_config;
    ResignHint m_result;
};

} // namespace gnubg_addon

#endif // HINT_WRAPPER_H