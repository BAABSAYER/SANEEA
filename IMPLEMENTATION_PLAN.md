# Saneea Request and Proposal Implementation Plan

## Product Goal

Saneea's mobile users may be older, non-technical customers. The app should feel like browsing beautiful event ideas, not filling a business form. The main journey should be:

1. See event types.
2. Browse visual templates with images, videos, and included items.
3. Choose a template, customize it, or request a custom event.
4. Send only the essential event details.
5. Receive a final proposal from Saneea.
6. Accept the proposal.
7. Upload deposit receipt.
8. Upload final payment receipt.

Prices shown before admin review are estimates only.

## Current System Fit

The existing schema already has most of the first version:

- `event_types` for event categories.
- `event_bundles` as current templates/packages.
- `event_items`, `bundle_items`, and `item_vendor_options` for included services and customization.
- `bookings` for submitted requests.
- quotation fields on `bookings` for proposal notes, validity, and final price.
- `payments` for deposit/final requests and receipt uploads.

The first implementation should improve the UX and use these existing structures. A deeper database migration can follow after the flow is proven.

## Phase 1: Immediate UX Alignment

Status: in progress.

Mobile:

- Rename user-facing package language to template language.
- Show event templates visually before asking for details.
- Show estimated price language instead of final price.
- Add simple guidance cards explaining the flow.
- Render questionnaire choice questions as large tap targets.
- Show proposal-ready state on booking details.
- Allow client to accept or reject a sent proposal.

Web/Admin:

- Keep existing proposal builder working.
- Update quotation wording to proposal wording.
- Use SAR labels instead of dollar labels.
- Continue sending payment requests after proposal acceptance.

Backend:

- Expose quotation/proposal fields in mobile booking detail.
- Add mobile proposal accept/reject endpoints using existing booking status flow:
  - `quotation_sent -> quotation_accepted`
  - `quotation_sent -> quotation_rejected`

## Phase 2: Dedicated Proposal Data Model

Add these tables when we need a stronger audit trail and richer proposal builder.

### `booking_proposals`

- `id`
- `booking_id`
- `status`: draft, sent, accepted, rejected, expired
- `total_price`
- `deposit_amount`
- `final_amount`
- `notes`
- `valid_until`
- `sent_at`
- `accepted_at`
- `rejected_at`
- `created_by`
- `created_at`
- `updated_at`

### `booking_proposal_items`

- `id`
- `proposal_id`
- `title`
- `description`
- `quantity`
- `unit_price`
- `total_price`
- `vendor_id`
- `event_item_id`
- `created_at`

### `booking_status_events`

- `id`
- `booking_id`
- `from_status`
- `to_status`
- `note`
- `created_by`
- `created_at`

## Phase 3: Dedicated Template Model

Current `event_bundles` can act as templates, but a cleaner future model is:

### `event_templates`

- `id`
- `event_type_id`
- `name`
- `description`
- `estimated_min_price`
- `estimated_max_price`
- `images`
- `videos`
- `tags`
- `is_active`
- `display_order`
- `created_at`
- `updated_at`

### `event_template_items`

- `id`
- `template_id`
- `event_item_id`
- `default_option_id`
- `title`
- `description`
- `images`
- `videos`
- `quantity`
- `is_required`
- `display_order`
- `created_at`
- `updated_at`

Migration path:

1. Backfill `event_templates` from `event_bundles`.
2. Backfill `event_template_items` from `bundle_items`.
3. Keep old endpoints temporarily.
4. Move mobile to template endpoints.
5. Retire package wording and old package-only endpoints.

## Phase 4: Visual Questionnaire Model

The existing `questionnaire_items.options` field supports simple arrays. For richer visual questions, add:

### `questionnaire_options`

- `id`
- `questionnaire_item_id`
- `label_ar`
- `label_en`
- `value`
- `image_url`
- `display_order`
- `created_at`

This allows elderly users to answer by choosing cards with pictures instead of typing.

## Phase 5: Admin Operating Flow

Admin booking detail should become the control center:

1. Review client request.
2. See selected template and selected items.
3. See questionnaire answers.
4. Preview attachments inline.
5. Create proposal from selected items.
6. Edit line-item prices.
7. Send proposal.
8. Send deposit request after acceptance.
9. Confirm deposit receipt.
10. Send final payment request.
11. Confirm final receipt.

## Recommended Next Work

1. Finish Phase 1 and test on a real phone.
2. Add `booking_proposals` and `booking_proposal_items`.
3. Replace the admin quotation modal with a full proposal page.
4. Add image-backed questionnaire options.
5. Convert `event_bundles` to proper `event_templates`.
