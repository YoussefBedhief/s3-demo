import z from "zod";

export const uploadFileSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  size: z.number(),
});
