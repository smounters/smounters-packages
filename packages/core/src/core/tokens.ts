import type {
  ExceptionFilterLike,
  GuardLike,
  HttpParamMeta,
  HttpRouteMeta,
  InjectionToken,
  InterceptorLike,
  ModuleMeta,
  PipeLike,
  RpcMethodDescriptor,
  RpcServiceDescriptor,
} from "../types.js";
import type { Logger } from "./logger.js";
import type { WsGatewayMeta, WsHandlerMeta, WsParamMeta } from "../ws/types.js";

// ============================================================================
// Единый реестр всех Symbol.for-токенов пакета @smounters/core
// ============================================================================

// --- App-level DI tokens ---
export const CONFIG_TOKEN: InjectionToken<unknown> = Symbol.for("app:config");
export const LOGGER_TOKEN: InjectionToken<Logger> = Symbol.for("imperium:app:logger");

export const APP_GUARD: InjectionToken<GuardLike> = Symbol.for("app:guard");
export const APP_INTERCEPTOR: InjectionToken<InterceptorLike> = Symbol.for("app:interceptor");
export const APP_PIPE: InjectionToken<PipeLike> = Symbol.for("app:pipe");
export const APP_FILTER: InjectionToken<ExceptionFilterLike> = Symbol.for("app:filter");

// --- Module metadata ---
export const MODULE_KEY: symbol = Symbol.for("imperium:module");

// --- Enhancer metadata ---
export const GUARDS_KEY: symbol = Symbol.for("imperium:guards");
export const INTERCEPTORS_KEY: symbol = Symbol.for("imperium:interceptors");
export const PIPES_KEY: symbol = Symbol.for("imperium:pipes");
export const FILTERS_KEY: symbol = Symbol.for("imperium:filters");
export const CATCH_EXCEPTIONS_KEY: symbol = Symbol.for("imperium:filter:exceptions");

// --- HTTP metadata ---
export const HTTP_ROUTES_KEY: symbol = Symbol.for("imperium:http:routes");
export const HTTP_CONTROLLER_KEY: symbol = Symbol.for("imperium:http:controller");
export const PARAMS_KEY: symbol = Symbol.for("imperium:http:params");

// --- RPC metadata ---
export const RPC_SERVICE_KEY: symbol = Symbol.for("imperium:rpc:service");
export const RPC_METHODS_KEY: symbol = Symbol.for("imperium:rpc:methods");
export const RPC_PARAMS_KEY: symbol = Symbol.for("imperium:rpc:params");

// --- WebSocket metadata ---
export const WS_GATEWAY_KEY: symbol = Symbol.for("imperium:ws:gateway");
export const WS_HANDLERS_KEY: symbol = Symbol.for("imperium:ws:handlers");
export const WS_PARAMS_KEY: symbol = Symbol.for("imperium:ws:params");

// Типизированные aliases для метаданных (используются в декораторах)
export type {
  HttpRouteMeta,
  HttpParamMeta,
  RpcServiceDescriptor,
  RpcMethodDescriptor,
  WsGatewayMeta,
  WsHandlerMeta,
  WsParamMeta,
  ModuleMeta,
};
