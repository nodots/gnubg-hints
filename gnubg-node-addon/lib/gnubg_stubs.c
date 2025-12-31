#include "backgammon.h"
#include <string.h>

int fAutoCrawford = 1;
int nAutoSaveTime = 15;
int fAutoSaveRollout = FALSE;
int fOutputMWC = FALSE;
int fShowProgress = FALSE;

matchstate ms;
rolloutcontext rcRollout = {0};

rngcontext *rngctxRollout = NULL;

ConstTanBoard
msBoard(void)
{
    return (ConstTanBoard) ms.anBoard;
}

moverecord *
get_current_moverecord(int *pfHistory)
{
    if (pfHistory)
        *pfHistory = 0;
    return NULL;
}

void
ChangeGame(listOLD *plGameNew)
{
    (void) plGameNew;
}

void
ProcessEvents(void)
{
}

int
GetManualDice(unsigned int anDice[2])
{
    anDice[0] = 0;
    anDice[1] = 0;
    return -1;
}

void
SetRNG(rng *prng, rngcontext *rngctx, rng rngNew, char *szSeed)
{
    (void) rngctx;
    (void) szSeed;
    if (prng)
        *prng = rngNew;
}

gboolean
save_autosave(gpointer unused)
{
    (void) unused;
    return FALSE;
}

char *
FormatMove(char *pch, const TanBoard anBoard, const int anMove[8])
{
    (void) anBoard;
    (void) anMove;
    if (pch)
        pch[0] = '\0';
    return pch;
}
