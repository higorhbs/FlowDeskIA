import { initAuthCreds, proto } from "@whiskeysockets/baileys";
import { BufferJSON } from "@whiskeysockets/baileys/lib/Utils/generics.js";

export interface WaAuthFileStore {
  businessId: string;
  read(file: string): Promise<string | null>;
  write(file: string, payload: string): Promise<void>;
  remove(file: string): Promise<void>;
  clear(): Promise<void>;
}

function fixFileName(file?: string | null) {
  return file?.replace(/\//g, "__").replace(/:/g, "-") ?? "";
}

export async function useRemoteAuthState(store: WaAuthFileStore) {
  const readData = async (file: string) => {
    const raw = await store.read(fixFileName(file));
    if (!raw) return null;
    try {
      return JSON.parse(raw, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const writeData = async (data: unknown, file: string) => {
    await store.write(fixFileName(file), JSON.stringify(data, BufferJSON.replacer));
  };

  const removeData = async (file: string) => {
    await store.remove(fixFileName(file));
  };

  const creds = (await readData("creds.json")) || initAuthCreds();

  const keys = {
    get: async (type: string, ids: string[]) => {
      const data: Record<string, unknown> = {};
      await Promise.all(
        ids.map(async (id) => {
          let value = await readData(`${type}-${id}.json`);
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value as object);
          }
          data[id] = value;
        })
      );
      return data;
    },
    set: async (data: Record<string, Record<string, unknown>>) => {
      const tasks: Promise<void>[] = [];
      for (const category in data) {
        for (const id in data[category]) {
          const value = data[category][id];
          const file = `${category}-${id}.json`;
          tasks.push(value ? writeData(value, file) : removeData(file));
        }
      }
      await Promise.all(tasks);
    },
  };

  return {
    state: {
      creds,
      keys,
    },
    saveCreds: () => writeData(creds, "creds.json"),
    clearAuth: () => store.clear(),
  };
}
