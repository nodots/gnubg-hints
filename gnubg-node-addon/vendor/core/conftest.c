/* confdefs.h */
#define PACKAGE_NAME "GNU Backgammon"
#define PACKAGE_TARNAME "gnubg"
#define PACKAGE_VERSION "1.08.003"
#define PACKAGE_STRING "GNU Backgammon 1.08.003"
#define PACKAGE_BUGREPORT "bug-gnubg@gnu.org"
#define PACKAGE_URL "https://www.gnu.org/software/gnubg/"
#define PACKAGE "gnubg"
#define VERSION "1.08.003"
#define USE_APPLE_OPENGL 1
#define HAVE_STDIO_H 1
#define HAVE_STDLIB_H 1
#define HAVE_STRING_H 1
#define HAVE_INTTYPES_H 1
#define HAVE_STDINT_H 1
#define HAVE_STRINGS_H 1
#define HAVE_SYS_STAT_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_UNISTD_H 1
#define HAVE_WCHAR_H 1
#define STDC_HEADERS 1
#define _ALL_SOURCE 1
#define _DARWIN_C_SOURCE 1
#define _GNU_SOURCE 1
#define _HPUX_ALT_XOPEN_SOCKET_API 1
#define _NETBSD_SOURCE 1
#define _OPENBSD_SOURCE 1
#define _POSIX_PTHREAD_SEMANTICS 1
#define __STDC_WANT_IEC_60559_ATTRIBS_EXT__ 1
#define __STDC_WANT_IEC_60559_BFP_EXT__ 1
#define __STDC_WANT_IEC_60559_DFP_EXT__ 1
#define __STDC_WANT_IEC_60559_EXT__ 1
#define __STDC_WANT_IEC_60559_FUNCS_EXT__ 1
#define __STDC_WANT_IEC_60559_TYPES_EXT__ 1
#define __STDC_WANT_LIB_EXT2__ 1
#define __STDC_WANT_MATH_SPEC_FUNCS__ 1
#define _TANDEM_SOURCE 1
#define __EXTENSIONS__ 1
#define HAVE_LIBCURL 1
#define LIBCURL_FEATURE_ASYNCHDNS 1
#define LIBCURL_FEATURE_GSS_API 1
#define LIBCURL_FEATURE_HSTS 1
#define LIBCURL_FEATURE_HTTP2 1
#define LIBCURL_FEATURE_HTTPS_PROXY 1
#define LIBCURL_FEATURE_KERBEROS 1
#define LIBCURL_FEATURE_LARGEFILE 1
#define LIBCURL_FEATURE_MULTISSL 1
#define LIBCURL_FEATURE_NTLM 1
#define LIBCURL_FEATURE_SPNEGO 1
#define LIBCURL_FEATURE_SSL 1
#define LIBCURL_FEATURE_UNIXSOCKETS 1
#define LIBCURL_FEATURE_ALT_SVC 1
#define LIBCURL_FEATURE_LIBZ 1
#define LIBCURL_FEATURE_THREADSAFE 1
#define LIBCURL_PROTOCOL_DICT 1
#define LIBCURL_PROTOCOL_FILE 1
#define LIBCURL_PROTOCOL_FTP 1
#define LIBCURL_PROTOCOL_FTPS 1
#define LIBCURL_PROTOCOL_GOPHER 1
#define LIBCURL_PROTOCOL_GOPHERS 1
#define LIBCURL_PROTOCOL_HTTP 1
#define LIBCURL_PROTOCOL_HTTPS 1
#define LIBCURL_PROTOCOL_IMAP 1
#define LIBCURL_PROTOCOL_IMAPS 1
#define LIBCURL_PROTOCOL_LDAP 1
#define LIBCURL_PROTOCOL_LDAPS 1
#define LIBCURL_PROTOCOL_MQTT 1
#define LIBCURL_PROTOCOL_POP3 1
#define LIBCURL_PROTOCOL_POP3S 1
#define LIBCURL_PROTOCOL_RTSP 1
#define LIBCURL_PROTOCOL_SMB 1
#define LIBCURL_PROTOCOL_SMBS 1
#define LIBCURL_PROTOCOL_SMTP 1
#define LIBCURL_PROTOCOL_SMTPS 1
#define LIBCURL_PROTOCOL_TELNET 1
#define LIBCURL_PROTOCOL_TFTP 1
#define HAVE_DLFCN_H 1
#define LT_OBJDIR ".libs/"
#define YYTEXT_POINTER 1
#define HAVE_FREETYPE 1
#define HAVE_LIBPNG 1
#define HAVE_CAIRO 1
#define HAVE_PANGOCAIRO 1
#define USE_SQLITE 1
#define HAVE_APPLE_COREAUDIO 1
#define HAVE___ATTRIBUTE__ 1
#define HAVE_FUNC_ATTRIBUTE_CONST 1
#define HAVE_FUNC_ATTRIBUTE_FALLTHROUGH 1
#define HAVE_FUNC_ATTRIBUTE_FORMAT 1
#define HAVE_FUNC_ATTRIBUTE_PURE 1
#define HAVE_FUNC_ATTRIBUTE_UNUSED 1
#define HAVE_LIBM 1
#define HAVE_SOCKETS 1
#define HAVE_LIB_READLINE 1
#define HAVE_STDARG_H 1
#define HAVE_SYS_RESOURCE_H 1
#define HAVE_SYS_SOCKET_H 1
#define HAVE_SYS_TIME_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_UNISTD_H 1
#define HAVE_SIGACTION 1
/* end confdefs.h.  */
/* Define sigvec to an innocuous variant, in case <limits.h> declares sigvec.
   For example, HP-UX 11i <limits.h> declares gettimeofday.  */
#define sigvec innocuous_sigvec

/* System header to define __stub macros and hopefully few prototypes,
   which can conflict with char sigvec (void); below.  */

#include <limits.h>
#undef sigvec

/* Override any GCC internal prototype to avoid an error.
   Use char because int might match the return type of a GCC
   builtin and then its argument prototype would still apply.  */
#ifdef __cplusplus
extern "C"
#endif
char sigvec (void);
/* The GNU C library defines this for functions which it implements
    to always fail with ENOSYS.  Some functions are actually named
    something starting with __ and the normal name is an alias.  */
#if defined __stub_sigvec || defined __stub___sigvec
choke me
#endif

int
main (void)
{
return sigvec ();
  ;
  return 0;
}
