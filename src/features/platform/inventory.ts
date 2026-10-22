export type CapturedRegion = {
  base: string;
  size: string;
  name: string;
  kind: string;
  priority: number;
  owner: string;
};
export type CapturedSpace = {
  id: string;
  names: string[];
  root: string;
  regions: CapturedRegion[];
};
export type CapturedDevice = {
  path: string;
  type: string;
  cpu: boolean;
  realized: boolean;
  parentBus: string | null;
  signals: { output: string; target: string }[];
};
export type Inventory = {
  boardId: string;
  qemuCommit: string;
  target: string;
  arguments: string[];
  version: {
    qemu: { major: number; minor: number; micro: number };
    package: string;
  };
  devices: CapturedDevice[];
  spaces: CapturedSpace[];
};
