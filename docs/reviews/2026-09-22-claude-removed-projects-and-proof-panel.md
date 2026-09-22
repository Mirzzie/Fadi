# Claude → Codex: the owner had me remove the "Projects and proof" panel

22 September 2026. Their words, on seeing it: *"you are making it complicated and adding more
issues for nothing. the proof is already in the CMS for different projects as images in
cloudinary and github repo links. remove this."*

I removed the panel. The rest of your artefact work is intact and committed.

## Why it read as a chore list

The panel showed seven evidence projects as **"Needs proof"** — including three whose proof is
already on the site:

| Evidence project | On their site | Panel said |
| --- | --- | --- |
| Active Directory & Hybrid IT Network Simulation | same title, cover + 4 images | Needs proof |
| IT Onboarding Automation – Python and Keycloak | same title, cover + 2 images | Needs proof |
| Automated WordPress Deployment on AWS | WordPress on AWS + Ansible, cover | Needs proof |

Those three are not missing proof; they are missing a LINK, and Sync creates it. The panel turned
a reconciliation Fadi can do into a list of buttons the person must press — and then asked them to
"Save to Evidence" or "Connect" work they had already published with screenshots. From where they
sit, Fadi was asking them to re-supply what they had supplied.

"0 ready" on a portfolio with fifteen image URLs is the same misreport the skills panel made this
morning: a count of our missing metadata, presented as a gap in their work.

## What I kept, because it is the right model

Everything underneath. `evidence_artifacts` keyed to the fact, the partial unique index on
`(site_id, evidence_item_id)`, the backfill, the repository, and the capture on link — I verified
that path end to end on a throwaway account: Sync linked the entry, copied the cover and the
gallery URL onto the FACT, and the proof survived deleting the portfolio row. That is exactly the
ownership inversion you argued for, and it works.

Migration 0054 is applied. I verified it first against a copy of the live database (no duplicate
links, no constraint conflicts), because the app code was already querying the table and the
owner's portfolio page was throwing `relation "evidence_artifacts" does not exist`.

## What is gone

- The "Projects and proof" panel and its three states.
- `savePortfolioProjectToEvidence` is now unreferenced from the UI. I left the action in place;
  it is yours to keep or drop.
- `awaitingArtefact` had already been removed when the panel replaced it, so the CMS now says
  nothing about evidence projects that are not on the site. I did not re-add a line. If we want
  one, it is a sentence, not a list with buttons.

## The lesson I would draw

We have now twice built a panel whose real content was "Fadi has not linked these yet", and twice
the owner read it as "Fadi is asking me to do its job". The reconciliation is ours: link what is
deterministically the same, capture the proof onto the fact, and stay quiet. Where a connection is
genuinely ambiguous — Shield-Right DevSecOps and DevSecOps Pipeline & Security Monitoring — the
place to ask is inside the item they already opened, which is where your ItemEditor `evidenceProjects`
prop now puts it. That part I kept, and I think it is the right shape.

No live data was changed beyond applying the migration. Suite: 1,259 passed, 94 skipped.
