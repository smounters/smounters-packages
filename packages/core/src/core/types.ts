import type { ConnectRouter } from "@connectrpc/connect";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRouteMeta {
  method: HttpMethod;
  path: string;
  handlerName: string;
}

export type HttpParamSource = "body" | "query" | "param" | "header" | "req" | "res";

export interface HttpParamMeta {
  index: number;
  source: HttpParamSource;
  key?: string;
}

export type RpcParamSource = "data" | "context" | "headers" | "header" | "abort_signal";

export interface RpcParamMeta {
  index: number;
  source: RpcParamSource;
  key?: string;
}

export type RpcServiceDescriptor = Parameters<ConnectRouter["service"]>[0];
export type RpcMethodDescriptor = Parameters<ConnectRouter["rpc"]>[0];

export interface RpcMethodMeta {
  method: RpcMethodDescriptor;
  handlerName: string;
}
