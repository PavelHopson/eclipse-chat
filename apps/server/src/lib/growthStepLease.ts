export type GrowthStepLease = {
  userId: string;
  step: string;
  controller: AbortController;
};

export class GrowthStepLeaseRegistry {
  private readonly active = new Map<string, GrowthStepLease>();

  get(runId: string): GrowthStepLease | undefined {
    return this.active.get(runId);
  }

  reserve(runId: string, lease: GrowthStepLease): boolean {
    if (this.active.has(runId)) return false;
    this.active.set(runId, lease);
    return true;
  }

  release(runId: string, controller: AbortController): void {
    if (this.active.get(runId)?.controller === controller) this.active.delete(runId);
  }
}
