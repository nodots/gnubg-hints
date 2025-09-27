/* Minimal config.h for GNU Backgammon addon */
#ifndef CONFIG_H
#define CONFIG_H

#define HAVE_CONFIG_H 1
#define GNUBG_ADDON 1

/* Math functions */
#define HAVE_LIBM 1

/* SIMD support */
#ifdef __SSE2__
#define USE_SIMD 1
#define USE_SSE2 1
#endif

/* Threading */
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#else
#define HAVE_PTHREAD 1
#endif

/* Disable unused features */
#undef USE_GTK
#undef USE_BOARD3D
#undef USE_PYTHON
#undef HAVE_SOCKETS
#undef LIBCURL_PROTOCOL_HTTPS

#endif /* CONFIG_H */
