/**
 * BGR Public API (package: bgrun)
 *
 * Import from 'bgrun' to use these functions in your own process-managing apps.
 */

// --- Types ---
export type { Process, History } from "./db";
export type { SystemProcessResource } from "./platform";
export type {
  GuardEvent,
  GuardRestartMetadata,
  GuardRestartReason,
} from "./history-events";
export type { CommandOptions } from "./types";

// --- Database Operations ---
export {
  db,
  getAllProcesses,
  getCurrentProcesses,
  getProcess,
  insertProcess,
  removeProcess,
  removeProcessByName,
  removeAllProcesses,
  updateProcessPid,
  updateProcessEnv,
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
  getProcessHistory,
  getRecentHistory,
  getHistoryByEvent,
  getRecentHistoryByEvents,
  addHistoryEntry,
  getDependencyGraph,
  addDependency,
  removeDependency,
  getStartOrder,
  retryDatabaseOperation,
  getDbInfo,
  dbPath,
  bgrHome,
} from "./db";

// --- Process Operations ---
export {
  isProcessRunning,
  isManagedProcessRunning,
  findManagedProcessPid,
  terminateProcess,
  readFileTail,
  getProcessPorts,
  findChildPid,
  findPidByPort,
  getShellCommand,
  killProcessOnPort,
  waitForPortFree,
  ensureDir,
  getHomeDir,
  isWindows,
  getProcessBatchResources,
  getSystemProcessResources,
  getListeningPortsByPid,
  getProcessMemory,
  reconcileProcessPids,
  resolvePidWithPorts,
} from "./platform";

// --- High-Level Commands ---
export { handleRun } from "./commands/run";
export { handleStop } from "./commands/cleanup";
export { getManagedChildProcesses } from "./managed-children";
export {
  handleEnvit,
  parseEnvitArgs,
  renderEnvitOutput,
} from "./commands/envit";
export { handleInline, parseInlineArgs } from "./commands/inline";
export {
  ensureProcessWatcher,
  stopProcessWatcher,
  syncProcessWatcher,
  getGuardRestartCounts,
  getRecentGuardEvents,
} from "./watcher";
export type {
  ResourceSnapshotRow,
  ResourceSnapshotOptions,
  ResourceSort,
} from "./resource-monitor";
export {
  sampleManagedResources,
  sampleSystemResources,
  sortResourceRows,
} from "./resource-monitor";

// --- Utilities ---
export { getErrorCode, getErrorMessage, hasErrorCode } from "./error-utils";
export {
  historyRowToGuardEvent,
  parseGuardRestartMetadata,
} from "./history-events";
export {
  measureRequired,
  runMeasure,
  platformMeasure,
  watcherMeasure,
  serverMeasure,
  dbMeasure,
  resourceMeasure,
} from "./observability";
export {
  TimeoutError,
  retry,
  withTimeout,
  withTimeoutFallback,
} from "./async-utils";
export {
  getVersion,
  calculateRuntime,
  parseEnvString,
  parseCommandEnv,
  getDeclaredPort,
  validateDirectory,
  acquireProcessOperationLock,
  isProcessOperationLocked,
  stringifyEnvString,
  getWatcherProcessName,
  getWatchedProcessName,
  isWatcherProcessName,
  isInternalProcessName,
} from "./utils";

// --- Default Export (namespace style) ---
import {
  db,
  getAllProcesses,
  getCurrentProcesses,
  getProcess,
  insertProcess,
  removeProcess,
  removeProcessByName,
  removeAllProcesses,
  updateProcessPid,
  updateProcessEnv,
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
  getProcessHistory,
  getRecentHistory,
  getHistoryByEvent,
  getRecentHistoryByEvents,
  addHistoryEntry,
  getDependencyGraph,
  addDependency,
  removeDependency,
  getStartOrder,
  retryDatabaseOperation,
  getDbInfo,
  dbPath,
  bgrHome,
} from "./db";
import {
  isProcessRunning,
  isManagedProcessRunning,
  findManagedProcessPid,
  terminateProcess,
  readFileTail,
  getProcessPorts,
  findChildPid,
  findPidByPort,
  getShellCommand,
  killProcessOnPort,
  waitForPortFree,
  ensureDir,
  getHomeDir,
  isWindows,
  getProcessBatchResources,
  getSystemProcessResources,
  getListeningPortsByPid,
  getProcessMemory,
  reconcileProcessPids,
  resolvePidWithPorts,
} from "./platform";
import { handleRun } from "./commands/run";
import { handleStop } from "./commands/cleanup";
import { getManagedChildProcesses } from "./managed-children";
import {
  handleEnvit,
  parseEnvitArgs,
  renderEnvitOutput,
} from "./commands/envit";
import { handleInline, parseInlineArgs } from "./commands/inline";
import {
  ensureProcessWatcher,
  stopProcessWatcher,
  syncProcessWatcher,
  getGuardRestartCounts,
  getRecentGuardEvents,
} from "./watcher";
import {
  sampleManagedResources,
  sampleSystemResources,
  sortResourceRows,
} from "./resource-monitor";
import {
  retry,
  withTimeout,
  withTimeoutFallback,
  TimeoutError,
} from "./async-utils";
import { getErrorCode, getErrorMessage, hasErrorCode } from "./error-utils";
import {
  historyRowToGuardEvent,
  parseGuardRestartMetadata,
} from "./history-events";
import {
  measureRequired,
  runMeasure,
  platformMeasure,
  watcherMeasure,
  serverMeasure,
  dbMeasure,
  resourceMeasure,
} from "./observability";
import {
  getVersion,
  calculateRuntime,
  parseEnvString,
  parseCommandEnv,
  getDeclaredPort,
  validateDirectory,
  acquireProcessOperationLock,
  isProcessOperationLocked,
  stringifyEnvString,
  getWatcherProcessName,
  getWatchedProcessName,
  isWatcherProcessName,
  isInternalProcessName,
} from "./utils";

export default {
  db,
  getAllProcesses,
  getCurrentProcesses,
  getProcess,
  insertProcess,
  removeProcess,
  removeProcessByName,
  removeAllProcesses,
  updateProcessPid,
  updateProcessEnv,
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
  getProcessHistory,
  getRecentHistory,
  getHistoryByEvent,
  getRecentHistoryByEvents,
  addHistoryEntry,
  getDependencyGraph,
  addDependency,
  removeDependency,
  getStartOrder,
  retryDatabaseOperation,
  getDbInfo,
  dbPath,
  bgrHome,
  isProcessRunning,
  isManagedProcessRunning,
  findManagedProcessPid,
  terminateProcess,
  readFileTail,
  getProcessPorts,
  findChildPid,
  findPidByPort,
  getShellCommand,
  killProcessOnPort,
  waitForPortFree,
  ensureDir,
  getHomeDir,
  isWindows,
  getProcessBatchResources,
  getSystemProcessResources,
  getListeningPortsByPid,
  getProcessMemory,
  reconcileProcessPids,
  resolvePidWithPorts,
  handleRun,
  handleStop,
  getManagedChildProcesses,
  handleEnvit,
  parseEnvitArgs,
  renderEnvitOutput,
  handleInline,
  parseInlineArgs,
  ensureProcessWatcher,
  stopProcessWatcher,
  syncProcessWatcher,
  getGuardRestartCounts,
  getRecentGuardEvents,
  sampleManagedResources,
  sampleSystemResources,
  sortResourceRows,
  TimeoutError,
  retry,
  withTimeout,
  withTimeoutFallback,
  getErrorCode,
  getErrorMessage,
  hasErrorCode,
  historyRowToGuardEvent,
  parseGuardRestartMetadata,
  measureRequired,
  runMeasure,
  platformMeasure,
  watcherMeasure,
  serverMeasure,
  dbMeasure,
  resourceMeasure,
  getVersion,
  calculateRuntime,
  parseEnvString,
  parseCommandEnv,
  getDeclaredPort,
  validateDirectory,
  acquireProcessOperationLock,
  isProcessOperationLocked,
  stringifyEnvString,
  getWatcherProcessName,
  getWatchedProcessName,
  isWatcherProcessName,
  isInternalProcessName,
};
