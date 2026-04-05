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
        "../eval.c",
        "../evallock.c",
        "../positionid.c",
        "../matchequity.c",
        "../matchid.c",
        "../rollout.c",
        "../dice.c",
        "../timer.c",
        "../mec.c",
        "../bearoff.c",
        "../bearoffgammon.c",
        "../glib-ext.c",
        "../multithread.c",
        "../mtsupport.c",
        "../util.c",
        "../lib/cache.c",
        "../lib/inputs.c",
        "../lib/list.c",
        "../lib/neuralnet.c",
        "../lib/isaac.c",
        "../lib/md5.c",
        "../lib/SFMT.c",
        "../lib/output.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "..",
        "../lib",
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
