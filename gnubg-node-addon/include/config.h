/* Minimal config.h for GNU Backgammon addon */
#ifndef CONFIG_H
#define CONFIG_H

#define HAVE_CONFIG_H 1
#define GNUBG_ADDON 1

#ifndef AC_DATADIR
#define AC_DATADIR "."
#endif

#ifndef AC_PKGDATADIR
#define AC_PKGDATADIR "."
#endif

#ifndef AC_DOCDIR
#define AC_DOCDIR "."
#endif

#ifndef PACKAGE
#define PACKAGE "gnubg"
#endif

#ifndef LOCALEDIR
#define LOCALEDIR "."
#endif

#ifndef GETTEXT_PACKAGE
#define GETTEXT_PACKAGE "gnubg"
#endif

#ifndef _
#define _(String) (String)
#endif

#ifndef N_
#define N_(String) (String)
#endif

/* Math functions */
#define HAVE_LIBM 1

/* SIMD support intentionally disabled for portability */

/* Threading */
#define USE_MULTITHREAD 1

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
