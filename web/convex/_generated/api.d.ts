/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_tmx from "../admin_tmx.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_tmx from "../lib/tmx.js";
import type * as lib_x_auth from "../lib/x_auth.js";
import type * as tables_biz_tmx_account_tokens from "../tables/biz_tmx_account_tokens.js";
import type * as tables_biz_tmx_accounts from "../tables/biz_tmx_accounts.js";
import type * as tables_data_cooked_tmx_profiles from "../tables/data_cooked_tmx_profiles.js";
import type * as tables_data_raw_tmx_auth_sessions from "../tables/data_raw_tmx_auth_sessions.js";
import type * as tables_data_raw_tmx_submissions from "../tables/data_raw_tmx_submissions.js";
import type * as xAuth from "../xAuth.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin_tmx: typeof admin_tmx;
  crons: typeof crons;
  http: typeof http;
  "lib/tmx": typeof lib_tmx;
  "lib/x_auth": typeof lib_x_auth;
  "tables/biz_tmx_account_tokens": typeof tables_biz_tmx_account_tokens;
  "tables/biz_tmx_accounts": typeof tables_biz_tmx_accounts;
  "tables/data_cooked_tmx_profiles": typeof tables_data_cooked_tmx_profiles;
  "tables/data_raw_tmx_auth_sessions": typeof tables_data_raw_tmx_auth_sessions;
  "tables/data_raw_tmx_submissions": typeof tables_data_raw_tmx_submissions;
  xAuth: typeof xAuth;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
