# Platform facelift · shared shell and public entry

**Owner:** Codex  
**Branch:** `codex/my-career-gate4`

## Direction correction

The named references are not merely colour references. Their useful common ground is structural:
large editorial type, generous rhythm, flat full-width regions, thin separators, restrained
rounding, clear product demonstrations and navigation that feels like part of the page rather than
a floating ornament.

This slice establishes that grammar at the two surfaces every journey shares: public entry and the
authenticated shell. Feature pages inherit it before they are migrated individually. Practice
behaviour is unchanged.

## Surface delta

### Public landing

- **Removed:** framed rounded mesh hero, magenta gradient CTA, dense feature-card wall.
- **Added:** full-width editorial hero, product signal column, flat divided feature regions.
- **Primary action before/after:** Sign Up Now → Sign Up Now; its authority is unchanged.

### Authentication

- **Removed:** floating form card over multiple blurred aurora blobs.
- **Added:** full-height editorial split with a contained form region and one quiet signal field.
- **Primary action before/after:** sign in or create account → unchanged.

### Authenticated shell

- **Removed:** desktop floating glass dock, pill-style section tabs and decorative violet wash.
- **Added:** persistent flat desktop rail, mobile bottom bar, underline section navigation and
  neutral canvas.
- **State owners:** navigation remains `navigation.ts`; pending decisions, direction, phase and
  Fadi presence retain their existing authorities.
- **Primary page actions:** unchanged; the shell does not compete with them.

## Rollout

The shell now reaches every authenticated route. Page-specific card walls and local hero styles are
still migrated journey by journey: Today, Opportunities, Practice projection, Documents,
Portfolio, Settings and remaining utilities. Claude retains Practice behaviour while it inherits
the shared shell and tokens.

