import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import serverless from "serverless-http";
import { createApp } from "../../backend/src/app.ts";

let slsHandler: ReturnType<typeof serverless> | null = null;

function getHandler() {
  if (!slsHandler) {
    process.env.NETLIFY = "true";
    slsHandler = serverless(createApp(), { binary: false });
  }
  return slsHandler;
}

function getRequestPath(event: HandlerEvent): string {
  if (event.rawUrl) {
    try {
      return new URL(event.rawUrl).pathname || "/";
    } catch {
      /* fall through */
    }
  }
  if (typeof event.path === "string" && event.path) return event.path;
  if (typeof event.rawPath === "string" && event.rawPath) return event.rawPath;
  return "/";
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const path = getRequestPath(event);

  const fixedEvent: HandlerEvent = {
    ...event,
    path,
    rawPath: path,
  };

  return getHandler()(fixedEvent, context);
};
