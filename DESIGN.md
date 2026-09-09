---
name: OFFSCRIPT
description: A cooperative mystery inside a listening station.
colors:
  blue: "#253bd6"
  ink: "#15191d"
  paper: "#f2efe3"
  lime: "#e0ed91"
  text: "#f7f5ec"
  supporting-text: "#d3d8fb"
  line: "rgba(244, 245, 255, 0.24)"
  instrument-line: "#3a4146"
  lime-hover: "#ecf5b9"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontWeight: 600
    lineHeight: 0.94
    letterSpacing: "-0.025em"
  document-title:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.1
  body:
    fontFamily: "Manrope, sans-serif"
    fontWeight: 400
    lineHeight: 1.7
  clue-body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.9
  control:
    fontFamily: "Manrope, sans-serif"
    fontWeight: 700
rounded:
  control: "2px"
  instrument: "3px"
spacing:
  compact: "8px"
  inline: "10px"
  control: "14px"
  group: "20px"
  panel: "24px"
  document: "30px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "14px 19px"
  button-primary-hover:
    backgroundColor: "{colors.lime-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "#e3e8dc"
    padding: "12px 0"
  button-share:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "18px 20px"
    width: "100%"
  clue-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "30px 30px 19px"
  clue-card-shared:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "20px 24px 15px"
  instrument:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.instrument}"
  field:
    backgroundColor: "#2a3036"
    textColor: "#f1f0e9"
    rounded: "{rounded.control}"
    padding: "10px"
    width: "100%"
---

# Design System: OFFSCRIPT

## Overview

**Creative North Star: "The Listening Station"**

OFFSCRIPT uses the material language of a listening station: an ultramarine field, charcoal instruments and pale clue documents. Condensed headlines establish the fictional case; clear sans-serif text supports reading, sharing and checking evidence.

The system is direct and tactile, with small corner radii, thin dividers and restrained ambient depth. Status is written in words alongside color or icons. The code-drawn signal belongs to the station world; evidence and action states come from the application.

**Key Characteristics:**

- Ultramarine surroundings, charcoal instruments and warm paper evidence.
- Barlow Condensed display typography paired with Manrope reading and controls.
- Lime links attention to actions, selected progress and signal details.
- Small radii, thin rules and soft ambient shadows.
- Keyboard-visible controls and a complete reduced-motion path.

Extracted from `src/styles.css`, `src/App.tsx`, `src/main.tsx` and the approved world contract in `index.html`. Values describe the implemented system; product plans remain in `PRODUCT.md`.

## Colors

An ultramarine ground holds dark working instruments and warm reading surfaces, with a pale lime accent.

### Primary

- **Station Ultramarine** (`blue`): the application field and blue focus treatment on paper.
- **Signal Lime** (`lime`): primary actions, the signal trace, role emphasis and progress markers. The lighter hover variant belongs to action feedback.

### Neutral

- **Instrument Ink** (`ink`): instrument surfaces and dark text on paper or lime.
- **Archive Paper** (`paper`): clue documents and the copyable invitation field.
- **Warm White** (`text`): default text on the station field.
- **Periwinkle Reading Text** (`supporting-text`): descriptions and supporting copy on ultramarine.
- **Field Rule** (`line`): translucent section boundaries on ultramarine.
- **Instrument Rule** (`instrument-line`): quiet separation inside charcoal instruments.

**The Material Roles Rule.** Use charcoal for instruments and warm paper for evidence; preserve the contrast between operating the station and reading a document.

## Typography

**Display Font:** Barlow Condensed, with sans-serif fallback.  
**Body Font:** Manrope, with sans-serif fallback.

The condensed face gives case and document titles a printed, purposeful silhouette. Manrope keeps dense evidence, controls and explanatory language clear. Font files are bundled through Fontsource: Barlow Condensed at 600/700 and Manrope at 400/500/600/700.

### Hierarchy

- **Case display:** weight 600 with tight leading and tracking. The entry title uses `clamp(66px, 6.9vw, 96px)`; the waiting title uses `clamp(55px, 5.8vw, 82px)`. These are surface-specific sizes, not a universal heading scale.
- **Desk heading:** `clamp(35px, 4vw, 57px)` on the main desktop layout.
- **Document title:** 36px on private paper and 27px on compact shared paper; both use condensed type and 1.1 leading.
- **Section title:** Manrope at 17–19px for working sections.
- **Reading text:** private clue text uses the clue-body token, with a maximum width of 540px. Shared clues use 14px and 1.8 leading.
- **Supporting copy and controls:** generally 11–14px; control weight increases for primary actions. Metadata uses compact type and restrained letter spacing only where it identifies documents, steps or station status.

**The Reading Voice Rule.** Use condensed type for case and document titles; keep clue text, controls and state explanations in Manrope.

## Layout

The application is centered at a maximum width of 1600px. Desktop sections share 5% side gutters. The masthead has a 100px height and a bottom rule.

Entry pairs the cooperative hook and room action with an interactive two-role paper preview; its column ratio is 1.15:1. Waiting pairs narrative with the station instrument at 1.1:1. The working desk pairs private and shared evidence at 0.9:1.1 with a 4% gap, and its case record aligns to that grid. On desktop the private desk stays in view while reading shared evidence. Maintain this relationship where a screen has private and shared materials; do not impose the entry composition on unrelated surfaces.

At 1000px and below, desktop gaps and type tighten, and the working columns become equal. At 700px and below, entry, waiting, desk and case record stack into one column; gutters become 6%, the masthead becomes 78px, and the invitation field and copy action stack. The start action precedes the role preview. Dispatch fields stack with 16px input text. The instructional strip retains a compact two-column arrangement. At 1600px and above, the entry receives more vertical space.

The spacing entries are recurring values extracted from the stylesheet, not an asserted mathematical scale. Reading surfaces receive more padding than inline controls.

## Elevation & Depth

Depth comes primarily from material contrast. The implemented shadows are blurred and low-opacity, separating instruments and private paper from the field without competing with the text.

### Shadow Vocabulary

- **Instrument ambient:** `0 16px 44px rgba(10, 17, 80, 0.18)` for entry and waiting instruments.
- **Instrument ambient, mobile:** `0 12px 28px rgba(10, 17, 80, 0.18)` at the mobile breakpoint.
- **Private paper:** `0 6px 18px rgba(10, 17, 80, 0.12)`.
- **Shared paper:** no shadow.

**The Ambient Depth Rule.** Use blurred shadows to lift instruments and private paper. Shared paper remains flat; do not replace the recorded shadows with hard offset blocks.

## Shapes

Controls and documents use nearly square 2px corners; entry and waiting instruments use 3px corners. Thin solid rules define divisions. The empty shared desk uses a dashed outline to signal an unfilled area. Status dots are circular and accompanied by text. The signal is native SVG geometry: fine orbital ellipses, a circular center and a lime waveform.

## Components

### Buttons

Primary buttons use lime over ink, a small radius, generous horizontal alignment and an arrow or status icon. The base minimum height is 50px. Hover lightens the background and lifts by 2px over 0.18s; disabled actions reduce opacity. Text actions are underlined, transparent and quieter.

The share action spans the paper width. After sharing, its background becomes deeper blue with lime text, an outline and a check icon; the text confirms that the clue is pinned to both desks.

### Cards / Containers

Private clue documents combine a type/source label, condensed title, readable evidence, original-source links and a ruled footer identifying private or shared copy. Shared documents compress padding and typography, omit shadow and arrive with a 0.4s reveal. Preserve the distinction between historical records and fictional evidence.

Charcoal instruments use thin internal dividers. Avoid treating every text group as a separate raised card.

### Inputs / Fields

Dispatch fields have charcoal-gray fills, pale text, a visible border and 2px corners. They are at least 48px high, with labels above and a format hint where needed. The invitation field uses paper and dark ink to make a copyable value easy to select. Disabled fieldsets visibly dim.

### Navigation

The condensed wordmark acts as the home control, with a lime slash. A connection dot is paired with a written connection state. The secondary return control uses a small chevron and text. On mobile, the edition phrase is hidden while connection state remains visible.

### Signal and state

The SVG signal draws in over 1.7s in the waiting room. It is decorative and hidden from assistive technology; it is not a live audio visualization. The landing role selector moves the selected paper forward over 0.45s and updates a role description; it is explicitly a preview, not game evidence. A spinner uses a 1.3s rotation only during pending work. Shared clue appearance and textual phase changes correspond to application state.

The case-progress strip reports the three puzzle stages and current completion from the actual player view. A player's own duplicate shared copy uses a native disclosure; the partner's clue stays expanded. Recent server feedback appears beside the dispatch controls as well as in the case record.

September 9 extensions: recovered testimony stays readable and appears only after the server reveals it. Guided AI actions distinguish a stage nudge from an ending reflection and show pending, withheld and failed states. Voice requires an explicit join; speaking indicators reflect local audio levels, unlike the decorative waiting-room signal. Keep mute, leave, microphone consent and the restrictive-network warning visible. Voice status must never imply that audio is recorded or sent to AI.

Global keyboard focus uses a 3px lime outline with a 5px offset; source links on paper use a blue outline. Reduced-motion preference disables animations and transitions throughout. Errors include readable text and an alert role; connection and completion notices carry status semantics.

## Do's and Don'ts

- Do preserve the field, instrument and paper material roles.
- Do keep functional status text beside colored dots or icons.
- Do keep clue provenance and private/shared copy labels visible.
- Do use inline step numbers with their headings.
- Do preserve focus-visible outlines, semantic labels and reduced-motion behavior.

- Don't imply a provider operation completed through animation or visual state alone.
- Don't turn compact document metadata into decorative headings above every section.
- Don't replace the listening station with a generic dashboard or chat-only composition.
- Don't require generated scene mockups or raster decoration to extend this code-built world.
