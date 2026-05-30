---
name: project-invitations-memberships-patterns
description: Recurring patterns from quiniela invitation & membership feature validation: redirect to dead route, duplicate hashToken logic, missing i18n key, missing action/component interaction tests
metadata:
  type: project
---

Patterns and gap types discovered during the quiniela invitation + membership feature validation.

**Why:** Saving for future validation runs on related features to know what to look for quickly.
**How to apply:** When validating future features that involve invitations, route redirects, or i18n key additions.

## Patterns observed

1. **Redirect to non-existent route after invite acceptance**: `acceptInviteAsExistingUser` and `acceptInviteAsNewUser` both redirect to `/${lang}/quinielas/${quinielaId}` but no page.tsx exists at that route level — only `/quinielas/[quinielaId]/members/page.tsx` exists. This is a recurring risk whenever a new sub-route-only module is added.

2. **Duplicate hashToken helper across page.tsx and actions.ts**: The same `hashToken()` function is copy-pasted into `invite/[token]/page.tsx` and `invite/[token]/actions.ts`. The service already has a private `hashToken()`. This pattern of duplicating crypto helpers in the view layer has appeared before.

3. **Missing i18n key for new error codes**: `NOT_A_MEMBER` is a valid service error returned by `leaveQuiniela` but has no translation key in `en.json` or `es.json`. New error codes added to service types are routinely forgotten in the dictionaries.

4. **Component tests cover state rendering but not error path interactions**: `MembersClient.test.tsx` and `InviteAcceptanceFlow.test.tsx` do not fire events that trigger service error responses — only happy-path submission flows are tested via interaction. Error display for CANNOT_REMOVE_ADMIN, NOT_A_MEMBER, ALREADY_REVOKED etc. are untested.

5. **SignUp password-mismatch maps to WEAK_PASSWORD error key**: `InviteAcceptanceFlow.tsx` L242 maps password != confirmPassword to `dict.errors.WEAK_PASSWORD` — wrong error semantics. No dedicated `PASSWORDS_DO_NOT_MATCH` key in `invite.errors` dictionary.

6. **`DB_ERROR` in `AcceptInviteResult` type surface is declared but never returned**: `InvitationsService.acceptInvite` has `DB_ERROR` in its return type union but the implementation only catches into `UNKNOWN_ERROR`. This is a surface mismatch.

7. **View layer bypasses architecture**: `invite/[token]/page.tsx` and `invite/[token]/actions.ts` import repositories directly (`InvitationsRepository`, `UsersRepository`) rather than routing through a service. The page duplicates invitation-status validation logic already in `InvitationsService`.
