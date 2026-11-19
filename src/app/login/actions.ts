"use server";

import { resolvePostLoginPath } from "@/modules/auth/post-login";

export async function getPostLoginPath() {
  return resolvePostLoginPath();
}
