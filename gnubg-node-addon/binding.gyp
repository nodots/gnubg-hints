{
  "targets": [
    {
      "target_name": "gnubg_hints",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "cflags": [
        "-O3",
        "-ffast-math",
        "-march=native"
      ],
      "sources": [
        "src/gnubg_addon.cpp",
        "src/hint_wrapper.cpp",
        "src/board_converter.cpp",
        "src/gnubg_core_wrapper.cpp",
        "lib/gnubg_core.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include",
        "lib",
        "../",
        "../lib"
      ],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "libraries": [
        "-lm",
        "<(module_root_dir)/../positionid.o",
        "<(module_root_dir)/../eval.o",
        "<(module_root_dir)/../util.o"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "HAVE_CONFIG_H",
        "USE_SIMD",
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
              "-march=native"
            ]
          }
        }],
        ["OS=='linux'", {
          "cflags": [
            "-O3",
            "-ffast-math",
            "-march=native",
            "-pthread"
          ],
          "libraries": [
            "-lpthread",
            "-lm"
          ]
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "Optimization": 3,
              "EnableIntrinsicFunctions": "true"
            }
          },
          "defines": [
            "WIN32_LEAN_AND_MEAN"
          ]
        }]
      ]
    }
  ]
}