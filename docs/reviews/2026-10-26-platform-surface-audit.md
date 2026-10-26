# Platform surface audit — 26 October 2026

Local branch: `codex/ui-integration-20261026`, following `a3792a4`. No push or main promotion.
The normal owner server and Claude's checkout are untouched. Candidate preview is `:3014`.

## Coverage means inspection, not execution of every feature

The browser inventory covers **29 authenticated route samples × two themes × two widths = 116
states**, plus **seven public/auth route samples × the same matrix = 28 states**. Widths are
390 and 1440px. Selected nested forms/dialogs additionally exercise 320px and simulated touch.

Authenticated samples include Today/overview/report; jobs, pipeline and documents; career record
and stories; portfolio; Profile and Settings; network, career exploration and interviews; Learning,
projects, machines and activity; both simulation start pages; resume/letter editors, their history
and print pages; one uncompleted project workspace; one opportunity workspace; and extension setup.
Public samples cover landing, sign-in/up, password recovery/reset, portfolio index and case study.

This is not a claim that every conditional state ran. A route returning 200 does not prove a lab,
provider check, interview, approval or publication succeeded. Those effects were not manufactured
to make the interface look complete. The project/letter/opportunity fixtures are synthetic,
uncompleted work with no earned evidence, external application or publication.

## Findings closed and surface delta

| Area                   | Before → after                                                                                                                                                                         | Authority / primary action                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Profile                | Labels visually adjacent but unbound; wrapped textarea/select labels could include their values → explicit, unique control IDs and native labels                                       | Existing profile form; Save unchanged                                                      |
| AI settings            | Unbound Model/API key/URL labels and duplicate datalist IDs across slots → instance-specific labels/IDs and selected-state semantics                                                   | Existing primary/fallback settings; no provider testing or saving in the audit             |
| Connected tools        | Placeholder-only fields; submission cleared the draft before a result → visible labels/shared inputs; retain entries on refused/failed transport and announce feedback inline          | Existing connection action and permission flag; Connect unchanged                          |
| Machine entry          | Unlabelled selects and 28–32px fields → bound labels, 40px fields and shared 44px coarse-pointer minimum                                                                               | Existing registration/proposal actions; Cancel creates nothing                             |
| Document fields        | Summary dictation did not name its textarea; Skills and several letter fields unnamed → field-specific accessible names                                                                | Existing document draft/version writer                                                     |
| Template picker        | Hand-positioned popup with no shared keyboard/focus handling → shared dropdown, collision placement and keyboard controls                                                              | Existing template choice; Templates unchanged                                              |
| Template replacement   | Native confirmation → named shared dialog with Cancel/Use template and focus return                                                                                                    | Existing draft replacement; no approval store or automatic submission                      |
| Portfolio import       | Browser Cancel entered a destructive replace branch → explicit Add, Replace and Cancel, followed by a separately named replace confirmation                                            | Existing import action and merge/replace modes; cancellation invokes neither               |
| Portfolio item removal | Native confirms for items/integrity findings → scoped named shared confirmation, distinguishing removal from permanent deletion                                                        | Existing item/dismissal action; no new career/evidence writer                              |
| Commands               | Fixed dark/green controls and silent clipboard failure → semantic theme tokens, usable targets and an inline manual-copy recovery                                                      | Existing clipboard/typing boundary; copying never executes                                 |
| Print                  | No main landmark → labelled standalone main, keeping paper colours and print behaviour                                                                                                 | Existing print/export route                                                                |
| Document headings      | Letter/generic editors and letter print views lacked a page heading → semantic heading without another visible toolbar or text on printed paper                                        | Existing document title                                                                    |
| Dock                   | A focused mobile textarea could scroll behind floating navigation → root scroll clearance only while the dock is visible                                                               | Existing hide/show state; no extra layout column or state                                  |
| Content                | LinkedIn described as inherently authoritative; account deletion copy overclaimed retention scope → person-supplied career history, reviewed sources and concrete local deletion scope | Existing intake/deletion behaviour; no proposed loop features advertised as built          |
| Extension popup        | Old teal/system-font appearance → shared generated palette/preferences, bundled Mona Sans, six appearance combinations and labelled status/connection controls                         | Existing capture/connect/autofill actions and permissions; none invoked in extension tests |

The confirmation component is presentation around existing actions, not a second approval system.
The extension consumes generated copies of the authoritative web tokens/preference contract; run
its `sync:appearance` script after changing those sources. Its own origin stores its visitor choice:
it does not read private web-app storage or synchronise account preferences. No manifest permission
was added. The bundled font licence accompanies the unmodified asset.

## Verification and evidence

- Web unit suite: **1,904 passed, 203 skipped**. Web production build includes TypeScript validation.
  Static portfolio build and its separate typecheck pass; its existing build-typecheck exemption
  was not expanded. Changed-source lint has zero errors and one existing mount-effect warning.
- **25 production browser tests passed** (four development-only checks are skipped there). The
  clipboard-refusal regression also passed separately on the development review surface.
  Production browser regression includes six-theme appearance/contrast, dialogs/history, delayed
  hydration, the whole signup/onboarding/workspace journey, live/static portfolio parity and the
  new nested-field, transport-failure, cancellation, keyboard and touch-target checks.
- The clipboard-refusal case runs against the actual command component in the development-only
  review page. A first attempt at the project fixture was invalid because environment gating
  correctly withheld that control. It was not treated as proof of live machine interaction.
- The real unpacked MV3 extension is tested in an isolated Chromium profile: all six appearance
  combinations, packaged font loading, labels, reflow and reload persistence. No connected token,
  site scraping, autofill, account change or external write is used.
- Final inventories: **116 authenticated + 28 public/auth states, zero structural findings** after
  fixes. The route inventory checks viewport overflow, landmarks/headings, named visible fields and
  controls, route errors and browser exceptions. This does not replace a full accessibility audit,
  a screen-reader session or physical-device testing.

REA passive corroboration uses only the synthetic profile: inventory
`ev_e18a077a29b2ad0d1078ac536545ef2bb079e34a64c924e4faf408d8d68820cb`, accessibility/DOM
`ev_f77c6d5540530767d53394a22ed6dc46d2c618a165644e9d81b25a885d072ff5`, viewport screenshot
`ev_a85ed4946f1b1ffba11737b19e610d1d8ab4fdda0b5520aaaef2ba0a8c016483`. These cover the selected
page and attach window, not prior activity or every screen. Interactive checks use Playwright.

Raw synthetic inventory and results remain outside Git under `/tmp/fadi-platform-audit`.
The extension screenshot is `/home/mirzzie/Projects/FADI-OCT/extension-audit-dark.png`.

## Remaining acceptance boundaries

1. Real lab framebuffer/input, machine start/reset/destructive recovery and provider-backed
   assessment states need bounded integration acceptance with the intended environment.
2. Voice-on/interruption and physical phones/screens/readers are not replaced by simulated touch.
3. Live third-party portal behaviour, external publication, account erasure and real connected-tool
   effects were intentionally not executed against the owner's data. Their controls retain the
   existing server authority and need their own integration checks.
4. Worker/evaluation/pinned-fetch reconciliation and Claude's rendering/Reflect acknowledgement
   remain separate gates. No schema change, capability runtime or worker activation here.
5. Paper/export typography and the independent fatal-error fallback are deliberate exceptions to
   decorative app chrome. Focused work omits decorative pointer travel; it does not lose theme tokens.

This closes the locally reproducible surface findings listed above. It does not certify that every
feature, every data combination or every external integration in Fadi has been exercised.
