// Format partagé (serveur bun + navigateur) de la trame du noyau NT : aucune dépendance native.
// Énumérations KTHREAD_STATE / KWAIT_REASON : winsiderss/phnt @53fbbdc5 ntkeapi.h.
export const THREAD_STATE = [
  "Initialized",
  "Ready",
  "Running",
  "Standby",
  "Terminated",
  "Waiting",
  "Transition",
  "DeferredReady",
  "GateWait",
  "WaitingForProcessInSwap",
];
export const WAIT_REASON = [
  "Executive",
  "FreePage",
  "PageIn",
  "PoolAllocation",
  "DelayExecution",
  "Suspended",
  "UserRequest",
  "WrExecutive",
  "WrFreePage",
  "WrPageIn",
  "WrPoolAllocation",
  "WrDelayExecution",
  "WrSuspended",
  "WrUserRequest",
  "WrEventPair",
  "WrQueue",
  "WrLpcReceive",
  "WrLpcReply",
  "WrVirtualMemory",
  "WrPageOut",
  "WrRendezvous",
  "WrKeyedEvent",
  "WrTerminated",
  "WrProcessInSwap",
  "WrCpuRateControl",
  "WrCalloutStack",
  "WrKernel",
  "WrResource",
  "WrPushLock",
  "WrMutex",
  "WrQuantumEnd",
  "WrDispatchInt",
  "WrPreempted",
  "WrYieldExecution",
  "WrFastMutex",
  "WrGuardedMutex",
  "WrRundown",
  "WrAlertByThreadId",
  "WrDeferredPreempt",
  "WrPhysicalFault",
  "WrIoRing",
  "WrMdlCache",
  "WrRcu",
];

// --- Trame rapide -------------------------------------------------------------------------------------------
// En-tête : 8 mots u32 (magic, ncpu, nproc, nthread, namesVersion, 0, tMs f64) puis 16 f32 de compteurs globaux.
// CPU : ncpu x 8 f32. Processus : nproc x 12 mots. Threads : nthread x 4 mots. Petit-boutiste.
export const FRAME = { header: 8, globals: 16, cpu: 8, proc: 12, thread: 4 } as const;
export const MAGIC = 0x314b544e; // "NTK1"

export type Slow = {
  t: string;
  basic: { pageSize: number; physicalMB: number; processors: number; timerResolution: number };
  modules: { name: string; path: string; size: number; order: number }[];
  pool: { tag: string; pagedMB: number; nonPagedMB: number; allocsPerSec: number }[];
  objects: { name: string; type: string; count: number }[];
  objectTypes: { name: string; index: number; objects: number; handles: number; pagedKB: number; nonPagedKB: number }[];
};
