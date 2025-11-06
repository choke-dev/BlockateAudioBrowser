import { z } from 'zod';

const WhitelistRequestSchema = z.object({
  audioId: z.coerce.bigint({
    error: 'Invalid audio ID'
  }).min(1n, 'Audio ID is required'),
  audioName: z.string().min(1, 'Audio name is required'),
  audioCategory: z.string().min(1, 'Audio category is required'),
  isPrivate: z.boolean().optional().default(false),
  skipModeration: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([])
});

export type WhitelistRequest = z.infer<typeof WhitelistRequestSchema>;
export default WhitelistRequestSchema;