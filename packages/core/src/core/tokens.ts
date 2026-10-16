import type { ExceptionFilterLike, GuardLike, InjectionToken, InterceptorLike, PipeLike } from "../types.js";

export const APP_GUARD: InjectionToken<GuardLike> = Symbol.for("app:guard");
export const APP_INTERCEPTOR: InjectionToken<InterceptorLike> = Symbol.for("app:interceptor");
export const APP_PIPE: InjectionToken<PipeLike> = Symbol.for("app:pipe");
export const APP_FILTER: InjectionToken<ExceptionFilterLike> = Symbol.for("app:filter");
