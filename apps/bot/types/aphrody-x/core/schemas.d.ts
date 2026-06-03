import { z } from "zod";
export declare const AuthorSchema: z.ZodObject<
  {
    username: z.ZodString;
    name: z.ZodString;
  },
  z.core.$strip
>;
export type Author = z.infer<typeof AuthorSchema>;
export declare const TweetSchema: z.ZodType<any>;
export type Tweet = z.infer<typeof TweetSchema>;
export declare const UserSchema: z.ZodObject<
  {
    id: z.ZodString;
    username: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    followers_count: z.ZodOptional<z.ZodNumber>;
    following_count: z.ZodOptional<z.ZodNumber>;
    is_blue_verified: z.ZodOptional<z.ZodBoolean>;
    profile_image_url: z.ZodOptional<z.ZodString>;
    created_at: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
export type User = z.infer<typeof UserSchema>;
export declare const ListInfoSchema: z.ZodObject<
  {
    id: z.ZodString;
    name: z.ZodString;
    member_count: z.ZodOptional<z.ZodNumber>;
    subscriber_count: z.ZodOptional<z.ZodNumber>;
    mode: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
export type ListInfo = z.infer<typeof ListInfoSchema>;
