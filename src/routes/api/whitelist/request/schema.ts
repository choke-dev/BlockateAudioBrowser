import { z } from 'zod';

const WhitelistRequestSchema = z.object({
  audioId: z.string().min(1, 'Audio ID is required'),
  audioName: z.string().min(1, 'Audio name is required'),
  audioCategory: z.string().min(1, 'Audio category is required'),
  isPrivate: z.boolean().optional().default(false)
});

export type WhitelistRequest = z.infer<typeof WhitelistRequestSchema>;
export default WhitelistRequestSchema;