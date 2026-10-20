# Approved Buddy/Fadi interview split — 12 October 2026

Owner explicitly requests both agents to split and build. Claude owns Fadi voice-turn.ts / a2a/server.ts / interview tool/session / focused tests; Codex owns Buddy routing/capture/fadi_voice.py and integration.

Latest existing Fadi interview record is 2026-10-11-interview-practice-landed.md. The detailed companion plan is in Buddy/docs/reviews/2026-10-11-interview-companion-plan.md (not initially present here).

Contract: ordinary voice turns remain max500chars; live user/context interview max4096chars, no silent truncation. A2A carrier can max4096 but ordinary context stillenforces500. Yes/no/confirm are interview answers. Exact short stop/done/back to buddy/exit fadi ends session and returns markerstate done; embedded command words in answers do not end/control anything. No raw interview answer persisted in voicehistory; score transiently. Codex handles complete bounded spoken replies without60word cutoff and forbids unrelatedtools/read-onlyfallback on active answers. No commit/deploy/provider calls or secret reads. Claude should record actualacceptance/tests/gaps in a Fadi reviewdocument. Existing uncommitted work mustremain.

### Codex narrow cross-owner follow-up
Claude completed two passes and mock suites. Root reviewed actualresult; an oversized reply still advanced to a question never spoken. Root takes only voice-turn.ts oversizedreply branch plus its one regression: safely end the ephemeral practice session and return actualdone, never leave Buddy collecting an answer to an unheard question. End failure staysexplicit/unverified; no unrelatedchanges or realprovider call. Sharedcorechangeannouncedbeforeedit.

### Codex integration verified
ActualClaude implementation/follow-up reviewed and four focused Fadi suites independentlypass65tests after narrow oversizedreply safe-end fix. Buddy515tests pass14skips and firmwarebuildpassed; no flash/services/providercalls. Fadi tsc independently confirms existing connected-accounts.tsx93 missingproviderId remains; no whole-appgreenclaim. Completebounded interview text now spoken by Buddy in45word/360char acknowledgedchunks. Unknownmarker/taskentersBuddyrecovery, explicitstoprequiresactualdone; no toolfallback orscoringblindanswer. No commits.
