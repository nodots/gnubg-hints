#include "sgf.h"
#include "list.h"
int sgf_y_dummy = 0;
listOLD *SGFParse(FILE *pf) { return NULL; }
void (*SGFErrorHandler) (const char *szMessage, int fParseError) = NULL;
