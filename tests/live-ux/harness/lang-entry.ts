/**
 * Client-language entry for the parent-page browser script (IIFE).
 *
 * Exposes the REAL editorClientLanguage helpers on window.__TAYA_LANG__
 * so the harness parent driver uses the exact production copy module
 * (ADD_ACTIONS, wherePhrase, areaName, kindHeader, pluralKind,
 * unavailableSentence) — same strings clients see in the dashboard.
 */
import {
  ADD_ACTIONS,
  wherePhrase,
  areaName,
  kindHeader,
  pluralKind,
  unavailableSentence,
} from "../../../artifacts/fsts-dashboard/src/lib/editorClientLanguage";

export { ADD_ACTIONS, wherePhrase, areaName, kindHeader, pluralKind, unavailableSentence };
