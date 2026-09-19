/**
 * Local stub for `lightning/uiListsApi`.
 *
 * sfdx-lwc-jest 7.9.0 ships a stub for this module, but it exports only
 * `getListInfoByName` and `getListInfosByName` — two of the ten adapters the module
 * actually has. `getListRecordsByName` and `getListInfosByObjectName` are missing, so
 * importing them under test throws. Delete this file and the moduleNameMapper entry
 * in jest.config.js once the package catches up.
 *
 * The stub's omission says nothing about platform support: the module's own
 * documentation lists all ten adapters and is explicit that it works in Experience
 * Builder Sites. Do not infer availability from what sfdx-lwc-jest happens to stub.
 *
 * Each export is registered with `createLdsTestWireAdapter`, matching how the shipped
 * uiObjectInfoApi stub does it: these are LDS adapters, so a test drives them with
 * `.emit(data)` and `.emitError()` and the component's `{ data, error }` handler
 * receives the same shape it would at runtime.
 */
import { createLdsTestWireAdapter } from "@salesforce/wire-service-jest-util";

export const createListInfo = createLdsTestWireAdapter(jest.fn());
export const deleteListInfo = createLdsTestWireAdapter(jest.fn());
export const getListInfoByName = createLdsTestWireAdapter(jest.fn());
export const getListInfosByName = createLdsTestWireAdapter(jest.fn());
export const getListInfosByObjectName = createLdsTestWireAdapter(jest.fn());
export const getListObjectInfo = createLdsTestWireAdapter(jest.fn());
export const getListPreferences = createLdsTestWireAdapter(jest.fn());
export const getListRecordsByName = createLdsTestWireAdapter(jest.fn());
export const updateListInfoByName = createLdsTestWireAdapter(jest.fn());
export const updateListPreferences = createLdsTestWireAdapter(jest.fn());
