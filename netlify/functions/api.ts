import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import serverless from "serverless-http";
import { createApp } from "../../backend/src/app.ts";

let slsHandler: ReturnType<typeof serverless> | null = null;

function getHandler() {
  if (!slsHandler) {
    process.env.NETLIFY = "true";
    const app = createApp();
    slsHandler = serverless(app, { binary: false });
  }
  return slsHandler;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const path =
    event.rawUrl?.replace(/^https?:\/\/[^/]+/, "") ||
    event.path ||
    "/";

  const fixedEvent: HandlerEvent = {
    ...event,
    path,
    rawPath: path,
  };

  return getHandler()(fixedEvent, context);
};
