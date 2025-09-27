#include <napi.h>
#include <array>
#include <functional>

namespace gnubg_addon {

// Functional board conversion utilities
namespace BoardConverter {

    // Convert JS board object to GNU BG format
    std::array<std::array<int, 25>, 2> fromJsBoard(const Napi::Object& jsBoard) {
        std::array<std::array<int, 25>, 2> gnubgBoard = {{{0}, {0}}};

        // Extract points
        if (jsBoard.Has("points")) {
            Napi::Array points = jsBoard.Get("points").As<Napi::Array>();

            for (uint32_t i = 0; i < points.Length(); i++) {
                Napi::Object point = points.Get(i).As<Napi::Object>();

                if (point.Has("checkers")) {
                    Napi::Array checkers = point.Get("checkers").As<Napi::Array>();

                    if (checkers.Length() > 0) {
                        // Get first checker to determine player
                        Napi::Object firstChecker = checkers.Get(uint32_t(0)).As<Napi::Object>();
                        std::string color = firstChecker.Get("color").As<Napi::String>().Utf8Value();

                        // Get position
                        Napi::Object position = point.Get("position").As<Napi::Object>();
                        int clockwisePos = position.Get("clockwise").As<Napi::Number>().Int32Value();
                        int counterPos = position.Get("counterclockwise").As<Napi::Number>().Int32Value();

                        // Map to GNU BG format using functional approach
                        auto mapToPlayer = [&](const std::string& c) -> int {
                            return c == "white" ? 0 : 1;
                        };

                        int player = mapToPlayer(color);
                        int pos = (player == 0) ? clockwisePos : counterPos;

                        gnubgBoard[player][pos] = checkers.Length();
                    }
                }
            }
        }

        // Extract bar
        if (jsBoard.Has("bar")) {
            Napi::Object bar = jsBoard.Get("bar").As<Napi::Object>();

            // Process each direction functionally
            auto processBarDirection = [&](const std::string& direction, int player) {
                if (bar.Has(direction)) {
                    Napi::Object barDir = bar.Get(direction).As<Napi::Object>();
                    if (barDir.Has("checkers")) {
                        Napi::Array checkers = barDir.Get("checkers").As<Napi::Array>();
                        gnubgBoard[player][0] = checkers.Length(); // Bar is position 0
                    }
                }
            };

            processBarDirection("clockwise", 0);
            processBarDirection("counterclockwise", 1);
        }

        return gnubgBoard;
    }

    // Convert GNU BG move format to JS format
    Napi::Array moveToJs(Napi::Env env, const int gnubgMove[8]) {
        auto jsMove = Napi::Array::New(env);
        int moveCount = 0;

        // Count valid moves (until we hit -1)
        for (int i = 0; i < 8 && gnubgMove[i] != -1; i += 2) {
            auto step = Napi::Object::New(env);
            step.Set("from", Napi::Number::New(env, gnubgMove[i]));
            step.Set("to", Napi::Number::New(env, gnubgMove[i + 1]));
            jsMove.Set(moveCount++, step);
        }

        return jsMove;
    }

    // Map GNU BG cube decision to string using functional approach
    std::string mapCubeDecision(int decision) {
        // Using switch expression pattern (functional style)
        switch (decision) {
            case 0: return "no-double";
            case 1: return "double";
            case 2: return "too-good";
            case 3: return "beaver";
            case 4: return "redouble";
            default: return "no-double";
        }
    }

    // Map GNU BG take decision to string
    std::string mapTakeDecision(int decision) {
        switch (decision) {
            case 0: return "drop";
            case 1: return "take";
            case 2: return "beaver";
            default: return "drop";
        }
    }

    // Convert evaluation array to object
    Napi::Object evalToJs(Napi::Env env, const float eval[7]) {
        auto obj = Napi::Object::New(env);
        obj.Set("win", Napi::Number::New(env, eval[0]));
        obj.Set("winGammon", Napi::Number::New(env, eval[1]));
        obj.Set("winBackgammon", Napi::Number::New(env, eval[2]));
        obj.Set("loseGammon", Napi::Number::New(env, eval[3]));
        obj.Set("loseBackgammon", Napi::Number::New(env, eval[4]));
        obj.Set("equity", Napi::Number::New(env, eval[5]));
        obj.Set("cubefulEquity", Napi::Number::New(env, eval[6]));
        return obj;
    }

} // namespace BoardConverter

} // namespace gnubg_addon