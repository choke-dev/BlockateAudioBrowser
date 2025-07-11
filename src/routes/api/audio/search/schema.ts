import { z } from 'zod';

export default z.object({
    filters: z.object({
        filters: z.array(
            z.object({
                label: z.string(),
                value: z.string(),
                inputValue: z.string(),
            })
        ),
        type: z.enum(["and", "or"])
    }).nullable(),
    sort: z.object({
        field: z.string(),
        order: z.enum(["asc", "desc"])
    }).nullable()
});