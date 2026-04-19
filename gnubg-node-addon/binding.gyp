{
  "targets": [
    {
      "target_name": "gnubg_hints",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags": [
        "-O3",
        "-ffast-math",
        "-march=native",
        "<!@(pkg-config --cflags glib-2.0 gobject-2.0 gthread-2.0)"
      ],
      "sources": [
        "src/gnubg_addon.cpp",
        "src/hint_wrapper.cpp",
        "src/board_converter.cpp",
        "src/gnubg_core_wrapper.cpp",
        "lib/gnubg_core.c",
        "lib/gnubg_stubs.c",
        "vendor/core/eval.c",
        "vendor/core/evallock.c",
        "vendor/core/positionid.c",
        "vendor/core/matchequity.c",
        "vendor/core/matchid.c",
        "vendor/core/rollout.c",
        "vendor/core/dice.c",
        "vendor/core/timer.c",
        "vendor/core/mec.c",
        "vendor/core/bearoff.c",
        "vendor/core/bearoffgammon.c",
        "vendor/core/glib-ext.c",
        "vendor/core/multithread.c",
        "vendor/core/mtsupport.c",
        "vendor/core/util.c",
        "vendor/core/lib/cache.c",
        "vendor/core/lib/inputs.c",
        "vendor/core/lib/list.c",
        "vendor/core/lib/neuralnet.c",
        "vendor/core/lib/isaac.c",
        "vendor/core/lib/md5.c",
        "vendor/core/lib/SFMT.c",
        "vendor/core/lib/output.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "vendor/core",
        "vendor/core/lib",
        "include"
      ],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "libraries": [
        "<!@(pkg-config --libs glib-2.0 gobject-2.0 gthread-2.0)",
        "-lm"
      ],
      "defines": [
        "NAPI_VERSION=8",
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "HAVE_CONFIG_H",
        "GNUBG_ADDON",
        "_GNU_SOURCE"
      ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_CFLAGS": [
              "-O3",
              "-ffast-math",
              "-march=native",
              "<!@(pkg-config --cflags glib-2.0 gobject-2.0 gthread-2.0)"
            ]
          }
        }],
        ["OS=='linux'", {
          "cflags": [
            "-O3",
            "-ffast-math",
            "-march=native",
            "-pthread",
            "<!@(pkg-config --cflags glib-2.0 gobject-2.0 gthread-2.0)"
          ],
          "libraries": [
            "<!@(pkg-config --libs glib-2.0 gobject-2.0 gthread-2.0)",
            "-lpthread",
            "-lm"
          ]
        }],
        ["OS=='win'", { }]
      ]
    }
  ]
}
