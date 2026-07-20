import type { ExceptionFilterLike, GuardLike, InjectionToken, InterceptorLike, PipeLike } from "../types.js";

export const APP_GUARD: InjectionToken<GuardLike> = Symbol.for("imperium:app:guard");
export const APP_INTERCEPTOR: InjectionToken<InterceptorLike> = Symbol.for("imperium:app:interceptor");
export const APP_PIPE: InjectionToken<PipeLike> = Symbol.for("imperium:app:pipe");
export const APP_FILTER: InjectionToken<ExceptionFilterLike> = Symbol.for("imperium:app:filter");
