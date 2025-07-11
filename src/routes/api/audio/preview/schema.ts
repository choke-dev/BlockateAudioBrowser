import { z } from 'zod';

const audioId = z.preprocess((val) => {
  if (typeof val === "string" || typeof val === "number") {
    try {
      return BigInt(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.bigint());

export default z.array(audioId);
